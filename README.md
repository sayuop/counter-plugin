# Counter Plugin for Obsidian

A simple Obsidian plugin that creates interactive number counters with +/- buttons.

## Usage

To create a counter, use the following syntax in your notes:

```
~ ( ) counter label
```

This will render as an interactive counter starting at 0, with minus and plus buttons to decrease or increase the value.

## Examples

```
~ ( ) Tasks completed
~ ( ) Days streak
~ ( ) Points earned
```

Each counter is independent and maintains its own value in your markdown file. When you click the +/- buttons, the value is updated in the source markdown.

## Installation

### From Release

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder named `counter-plugin` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable the plugin in Settings → Community plugins

### Manual Installation

1. Clone this repository into your vault's `.obsidian/plugins/` directory
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Reload Obsidian
5. Enable the plugin in Settings → Community plugins

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode (auto-rebuild on changes)
npm run dev
```

## License

MIT
