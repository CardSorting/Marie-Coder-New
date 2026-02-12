# Marie CLI

A Claude Code-inspired AI coding agent that runs in your terminal.

## Installation

```bash
npm install
npm run build
```

## Usage

### Set up API Key

```bash
export ANTHROPIC_API_KEY=your_key_here
```

Or configure via the config file at `~/.marie/config.json`:

```json
{
  "apiKey": "your_key_here",
  "model": "claude-3-5-sonnet-20241022"
}
```

### Run the CLI

```bash
npm start
# or
./dist/cli-standalone/index.js
# or after global install
marie
```

## Commands

Once in the CLI:

- Type your message to chat with Marie
- `/help` - Show available commands
- `/clear` - Clear the screen
- `/exit` - Exit the CLI

## Available Tools

Marie can use the following tools:

- `read_file` - Read file contents
- `write_file` - Write content to files
- `list_dir` - List directory contents
- `run_command` - Execute shell commands

## Session Management

Sessions are automatically saved to `~/.marie/sessions.json`.
