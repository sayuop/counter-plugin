import { Plugin, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';

export default class CounterPlugin extends Plugin {
	async onload() {
		console.log('Loading Counter Plugin');

		this.registerMarkdownPostProcessor((element, context) => {
			this.processCounters(element, context);
		});

		this.registerEvent(
			this.app.workspace.on('editor-change', () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					// Refresh the preview to update counters
					view.previewMode.rerender(true);
				}
			})
		);
	}

	onunload() {
		console.log('Unloading Counter Plugin');
	}

	processCounters(element: HTMLElement, context: MarkdownPostProcessorContext) {
		const counterRegex = /^~\s*\(\s*(\d*)\s*\)\s*(.*)$/;
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		const nodesToReplace: Array<{ node: Node; parent: Node }> = [];

		let node;
		while ((node = walker.nextNode())) {
			const text = node.textContent || '';
			const lines = text.split('\n');

			lines.forEach((line, index) => {
				const match = line.match(counterRegex);
				if (match) {
					nodesToReplace.push({ node, parent: node.parentNode! });
				}
			});
		}

		nodesToReplace.forEach(({ node, parent }) => {
			const text = node.textContent || '';
			const lines = text.split('\n');
			const fragment = document.createDocumentFragment();

			lines.forEach((line, index) => {
				const match = line.match(counterRegex);

				if (match) {
					const currentValue = match[1] === '' ? 0 : parseInt(match[1], 10);
					const label = match[2].trim();

					const counterContainer = this.createCounterElement(
						currentValue,
						label,
						node,
						context
					);

					fragment.appendChild(counterContainer);
				} else {
					if (line) {
						fragment.appendChild(document.createTextNode(line));
					}
				}

				if (index < lines.length - 1) {
					fragment.appendChild(document.createTextNode('\n'));
				}
			});

			parent.replaceChild(fragment, node);
		});
	}

	createCounterElement(
		value: number,
		label: string,
		sourceNode: Node,
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
