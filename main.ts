import { Plugin, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';

export default class CounterPlugin extends Plugin {
	async onload() {
		console.log('Loading Counter Plugin');

		this.registerMarkdownPostProcessor((element, context) => {
			this.processCounters(element, context);
		});
	}

	onunload() {
		console.log('Unloading Counter Plugin');
	}

	processCounters(element: HTMLElement, context: MarkdownPostProcessorContext) {
		const counterRegex = /~\s*\(\s*(\d*)\s*\)\s*(.+)/g;
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		const nodesToReplace: Array<{ node: Node; parent: Node; replacements: Array<{type: 'text' | 'counter', content: string, value?: number, label?: string}> }> = [];

		let node: Node | null;
		while ((node = walker.nextNode()) !== null) {
			const text = node.textContent || '';

			if (counterRegex.test(text)) {
				counterRegex.lastIndex = 0;
				const replacements: Array<{type: 'text' | 'counter', content: string, value?: number, label?: string}> = [];
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
						label: label
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
		value: number,
		label: string,
		context: MarkdownPostProcessorContext
	): HTMLElement {
		const container = document.createElement('div');
		container.className = 'counter-container';

		const minusButton = document.createElement('button');
		minusButton.className = 'counter-button counter-minus';
		minusButton.textContent = '−';
		minusButton.setAttribute('aria-label', 'Decrease counter');

		const counterDisplay = document.createElement('span');
		counterDisplay.className = 'counter-display';
		counterDisplay.textContent = value.toString();

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
			const counterRegex = /^~\s*\(\s*\d*\s*\)\s*(.*)$/gm;

			let matchIndex = 0;
			const newContent = content.replace(counterRegex, (match, capturedLabel) => {
				const currentLabel = capturedLabel.trim();
				if (currentLabel === label) {
					matchIndex++;
					return `~ (${newValue}) ${label}`;
				}
				return match;
			});

			if (content !== newContent) {
				editor.setValue(newContent);
			}
		};

		minusButton.addEventListener('click', () => {
			const newValue = value - 1;
			counterDisplay.textContent = newValue.toString();
			updateSource(newValue);
		});

		plusButton.addEventListener('click', () => {
			const newValue = value + 1;
			counterDisplay.textContent = newValue.toString();
			updateSource(newValue);
		});

		container.appendChild(minusButton);
		container.appendChild(counterDisplay);
		container.appendChild(plusButton);
		if (label) {
			container.appendChild(labelSpan);
		}

		return container;
	}
}
