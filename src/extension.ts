// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Important lines:

// *---------------------------------------------------------*

// 17: Getting bookmarks from Bookmarks plugin
// 57: Main method: updating table of contents
// 153: Misc. VS Code plugin stuff

// *---------------------------------------------------------*


// Getting bookmarks from Bookmarks plugin

// while not taking arguments, getBookmarks() builds off of the current editor's
// document to extract all bookmarks (found in config file from Bookmarks plugin)
// and returns them as a plain array of integera
async function getBookmarks(): Promise<number[]> {
	try {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showInformationMessage('No workspace is open.');
			return [];
		}
		const rootPath = workspaceFolders[0].uri.fsPath;

		// print the local path of the document with respect to the workspace root

		// read file at rootPath, subdirectory .vscode, file bookmarks.json (account for file slash orientation)
		const bookmarksData = JSON.parse(fs.readFileSync(path.join(rootPath, '.vscode', 'bookmarks.json'), 'utf8'));

		const uri = vscode.window.activeTextEditor?.document.uri;
		if (uri) {
			const filePath = vscode.workspace.asRelativePath(uri);
			// get the element from "files" whose "path" property matches the local path of the file function is called from
			const bookmarks = bookmarksData.files.find((file: any) => file.path === filePath)?.bookmarks;
			// create an array of integers by collecting value of "line" property from each element in bookmarks
			const bookmarkLines = bookmarks.map((bookmark: any) => bookmark.line);
			return bookmarkLines;
		}

		else {
			return [];
		}
	} catch (error) {
		console.error('Error reading bookmarks:', error);
		vscode.window.showInformationMessage('Could not read bookmarks. Have you enabled "Save Bookmarks in Projects" in the Bookmarks extension settings?');
		return [];
	}
}


// Main method: updating table of contents

// When the command bookmarks-toc-gen.updateTableOfContents is called, this method is
// then called on the active text editor (as such, must have an active text editor to use)
async function updateTableOfContents(editor: vscode.TextEditor): Promise<void> {
	const document = editor.document;
	const bookmarks = await getBookmarks();

	const edit = new vscode.WorkspaceEdit();
	// Get the table of contents separator from the configuration
	const config = vscode.workspace.getConfiguration('michael-psenka.bookmarks-toc-gen');
	const separator = config.get<string>('separator') || '*---------------------------------------------------------*';
	const maxSearch = config.get<number>('maxLinesSearch') || 100;

	// Find the start and end lines of the table of contents
	let startLine = -1;
	let endLine = -1;
	// for efficiency, we don't want to search the entire document
	for (let i = 0; i < document.lineCount && i < maxSearch; i++) {
		const line = document.lineAt(i);
		// check if the line contains the separator (possibly with at most 5 characters before)
		// due to comments
		if (line.text.substring(0, separator.length + 5).includes(separator)) {
			if (startLine === -1) {
				startLine = i;
			} else {
				endLine = i;
				break;
			}
		}
	}

	// If the table of contents exists, delete it
	if (startLine != -1 && endLine != -1) {
		edit.delete(document.uri, new vscode.Range(startLine, 0, endLine+1, 0));
		// edit.insert(document.uri, new vscode.Position(startLine, 0), '\n');
		// await vscode.workspace.applyEdit(edit);
		vscode.window.showInformationMessage('TOC-GEN: Detected and deleted table of contents between lines ' + (startLine + 1) + ' and ' + (endLine + 1) + '.');
	}

	else {
		startLine = 0;
		endLine = 0;
	}

	// now we need to account for the difference in how long the TOC was before vs. how
	// long it will be now after the update

	// the following is the difference in what we display for the line number
	let bibChangeOffset = bookmarks.length - (endLine - startLine - 3);
	// account for difference when toc has not been created yet
	if (startLine == 0 && endLine == 0) {
		bibChangeOffset += 1;
	}

	// Insert the new table of contents
	const tocLines = [];
	tocLines.push(separator);
	tocLines.push('');
	for (const bookmark of bookmarks) {
		const line = document.lineAt(bookmark);
		// extract the non-comment text, by taking the substring starting from the first
		// alphabetical character, using regex
		const regex = /[a-zA-Z]/;
		const indAlphFirst = line.text.search(regex);
		// find the last occurence of regex by flipping the string, then searching, then doing additive complement
		const indAlphLast = line.text.length - 1 - line.text.split('').reverse().join('').search(regex);
		// find the index of the final character
		
		const lineNoComment = line.text.substring(indAlphFirst, indAlphLast+1);

		// note that line numbers in bookmark are 0-indexed. and as described before,
		// we need to account for the lines we are now potentially creating for the table of contents
		tocLines.push(`${bookmark + 1 + bibChangeOffset}: ${lineNoComment}`);
	}
	tocLines.push('');
	tocLines.push(separator);
	tocLines.push('');

	// insert all tocLines at line startLine
	edit.insert(document.uri, new vscode.Position(startLine, 0), tocLines.join('\n'));

	await vscode.workspace.applyEdit(edit);
	vscode.window.showInformationMessage('TOC-GEN: Inserted new table of contents between lines ' + (startLine + 1) + ' and ' + (startLine + tocLines.length - 1) + '.');
	// finally, comment out the table of contents
	const startLineComment = document.lineAt(startLine);
	const endLineComment = document.lineAt(startLine + tocLines.length - 2);
	// vscode.commands.executeCommand('editor.action.commentLine');
	editor.selection = new vscode.Selection(startLineComment.range.start, endLineComment.range.end);
	await vscode.commands.executeCommand('editor.action.commentLine');
	// remove the selection
	let posEditor = editor.selection.end; 
	editor.selection = new vscode.Selection(posEditor, posEditor);

}

// Misc. VS Code plugin stuff
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "bookmarks-toc-gen" is now active!');

	let appendBookmarksDisposable = vscode.commands.registerTextEditorCommand('bookmarks-toc-gen.updateTableOfContents', (editor) => {
		updateTableOfContents(editor);
	});

	context.subscriptions.push(appendBookmarksDisposable);
}

export function deactivate() { }

