import { Plugin, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';
import { Decoration, DecorationSet, EditorView, WidgetType, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

class CounterWidget extends WidgetType {
	constructor(private value: number, private label: string, private originalText: string, private plugin: CounterPlugin, private position: number) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		return this.plugin.createCounterElement(this.value, this.label, this.originalText, null, this.position);
	}
}

function buildCounterDecorations(view: EditorView, plugin: CounterPlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const counterRegex = /~\s*\(\s*(-?\d*)\s*\)\s*(.+)/g;

	for (let { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		let match;
		counterRegex.lastIndex = 0;

		while ((match = counterRegex.exec(text)) !== null) {
			const startPos = from + match.index;
			const endPos = startPos + match[0].length;
			const value = match[1] === '' ? 0 : parseInt(match[1], 10);
			const label = match[2].trim();
			const originalText = match[0];

			const widget = Decoration.replace({
				widget: new CounterWidget(value, label, originalText, plugin, startPos),
			});

			builder.add(startPos, endPos, widget);
		}
	}

	return builder.finish();
}

export default class CounterPlugin extends Plugin {
	async onload() {
		console.log('Loading Counter Plugin');

		this.registerMarkdownPostProcessor((element, context) => {
			this.processCounters(element, context);
		});

		const plugin = this;
		this.registerEditorExtension(
			ViewPlugin.fromClass(
				class {
					decorations: DecorationSet;

					constructor(view: EditorView) {
						this.decorations = buildCounterDecorations(view, plugin);
					}

					update(update: ViewUpdate) {
						if (update.docChanged || update.viewportChanged) {
							this.decorations = buildCounterDecorations(update.view, plugin);
						}
					}
				},
				{
					decorations: (v) => v.decorations,
				}
			)
		);
	}

	onunload() {
		console.log('Unloading Counter Plugin');
	}

	processCounters(element: HTMLElement, context: MarkdownPostProcessorContext) {
		const counterRegex = /~\s*\(\s*(-?\d*)\s*\)\s*(.+)/g;
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		const nodesToReplace: Array<{ node: Node; parent: Node; replacements: Array<{type: 'text' | 'counter', content: string, value?: number, label?: string, originalText?: string}> }> = [];

		let node: Node | null;
		while ((node = walker.nextNode()) !== null) {
			const text = node.textContent || '';

			if (counterRegex.test(text)) {
				counterRegex.lastIndex = 0;
				const replacements: Array<{type: 'text' | 'counter', content: string, value?: number, label?: string, originalText?: string}> = [];
				let lastIndex = 0;
				let match;

				while ((match = counterRegex.exec(text)) !== null) {
					if (match.index > lastIndex) {
						replacements.push({
							type: 'text',
							content: text.substring(lastIndex, match.index)
						});
					}

					const value = match[1] === '' ? 0 : parseInt(match[1], 10);
					const label = match[2].trim();

					replacements.push({
						type: 'counter',
						content: match[0],
						value: value,
						label: label,
						originalText: match[0]
					});

					lastIndex = match.index + match[0].length;
				}

				if (lastIndex < text.length) {
					replacements.push({
						type: 'text',
						content: text.substring(lastIndex)
					});
				}

				if (replacements.length > 0) {
					nodesToReplace.push({ node, parent: node.parentNode!, replacements });
				}

				counterRegex.lastIndex = 0;
			}
		}

		nodesToReplace.forEach(({ node, parent, replacements }) => {
			const fragment = document.createDocumentFragment();

			replacements.forEach(replacement => {
				if (replacement.type === 'counter') {
					const counterContainer = this.createCounterElement(
						replacement.value!,
						replacement.label!,
						replacement.originalText!,
						context
					);
					fragment.appendChild(counterContainer);
				} else {
					fragment.appendChild(document.createTextNode(replacement.content));
				}
			});

			parent.replaceChild(fragment, node);
		});
	}

	createCounterElement(
		initialValue: number,
		label: string,
		originalText: string,
		context: MarkdownPostProcessorContext | null,
		position?: number
	): HTMLElement {
		const container = document.createElement('div');
		container.className = 'counter-container';

		// Store the section info to locate this specific counter (only available in reading mode)
		const sectionInfo = context?.getSectionInfo?.(container);

		let currentValue = initialValue;

		const minusButton = document.createElement('button');
		minusButton.className = 'counter-button counter-minus';
		minusButton.textContent = '−';
		minusButton.setAttribute('aria-label', 'Decrease counter');

		const counterDisplay = document.createElement('span');
		counterDisplay.className = 'counter-display';
		counterDisplay.textContent = currentValue.toString();

		const plusButton = document.createElement('button');
		plusButton.className = 'counter-button counter-plus';
		plusButton.textContent = '+';
		plusButton.setAttribute('aria-label', 'Increase counter');

		const labelSpan = document.createElement('span');
		labelSpan.className = 'counter-label';
		labelSpan.textContent = label;

		const updateSource = (oldValue: number, newValue: number) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;

			const editor = view.editor;
			const counterRegex = /~\s*\(\s*(-?\d*)\s*\)\s*(.+)/;

			// If we have a position (from edit mode), use it to find the exact counter
			if (position !== undefined) {
				// Convert document position to line number
				const content = editor.getValue();
				let currentPos = 0;
				let targetLine = 0;

				const lines = content.split('\n');
				for (let i = 0; i < lines.length; i++) {
					const lineEndPos = currentPos + lines[i].length;
					if (position >= currentPos && position <= lineEndPos) {
						targetLine = i;
						break;
					}
					currentPos = lineEndPos + 1; // +1 for the newline character
				}

				const lineText = editor.getLine(targetLine);
				const match = lineText.match(counterRegex);

				if (match && match[2].trim() === label) {
					const matchedValue = match[1] === '' ? 0 : parseInt(match[1], 10);

					// Verify this is our counter by checking the value
					if (matchedValue === oldValue) {
						const newText = lineText.replace(counterRegex, `~ (${newValue}) ${label}`);
						editor.setLine(targetLine, newText);
						return;
					}
				}
			}

			// Get section info to find the exact line range (reading mode)
			if (sectionInfo) {
				const lineStart = sectionInfo.lineStart;
				const lineEnd = sectionInfo.lineEnd;

				// Search only within this section
				for (let line = lineStart; line <= lineEnd; line++) {
					const lineText = editor.getLine(line);
					const match = lineText.match(counterRegex);

					if (match && match[2].trim() === label) {
						const matchedValue = match[1] === '' ? 0 : parseInt(match[1], 10);

						// Only update if this counter has the old value
						if (matchedValue === oldValue) {
							const newText = lineText.replace(counterRegex, `~ (${newValue}) ${label}`);
							editor.setLine(line, newText);
							return;
						}
					}
				}
			}
		};

		minusButton.addEventListener('click', (e) => {
			e.stopPropagation();
			const oldValue = currentValue;
			currentValue = currentValue - 1;
			counterDisplay.textContent = currentValue.toString();
			updateSource(oldValue, currentValue);
		});

		plusButton.addEventListener('click', (e) => {
			e.stopPropagation();
			const oldValue = currentValue;
			currentValue = currentValue + 1;
			counterDisplay.textContent = currentValue.toString();
			updateSource(oldValue, currentValue);
		});

		container.appendChild(counterDisplay);
		container.appendChild(minusButton);
		container.appendChild(plusButton);
		if (label) {
			container.appendChild(labelSpan);
		}

		return container;
	}
}
