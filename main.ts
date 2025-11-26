import { Plugin, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';
import { Decoration, DecorationSet, EditorView, WidgetType, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

class CounterWidget extends WidgetType {
	constructor(private value: number, private label: string, private originalText: string, private plugin: CounterPlugin) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		return this.plugin.createCounterElement(this.value, this.label, this.originalText, {} as MarkdownPostProcessorContext);
	}
}

function buildCounterDecorations(view: EditorView, plugin: CounterPlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const counterRegex = /~\s*\(\s*(\d*)\s*\)\s*(.+)/g;

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
				widget: new CounterWidget(value, label, originalText, plugin),
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
		const counterRegex = /~\s*\(\s*(\d*)\s*\)\s*(.+)/g;
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
		context: MarkdownPostProcessorContext
	): HTMLElement {
		const container = document.createElement('div');
		container.className = 'counter-container';

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

		const updateSource = (newValue: number) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;

			const editor = view.editor;
			const content = editor.getValue();

			// Find and replace only the first occurrence of this exact counter text
			const index = content.indexOf(originalText);
			if (index !== -1) {
				const newText = `~ (${newValue}) ${label}`;
				const newContent = content.substring(0, index) + newText + content.substring(index + originalText.length);
				editor.setValue(newContent);
			}
		};

		minusButton.addEventListener('click', () => {
			currentValue = currentValue - 1;
			counterDisplay.textContent = currentValue.toString();
			updateSource(currentValue);
		});

		plusButton.addEventListener('click', () => {
			currentValue = currentValue + 1;
			counterDisplay.textContent = currentValue.toString();
			updateSource(currentValue);
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
