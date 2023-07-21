// The module 'vscode' contains the VS Code extensibility API testing testing
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


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

async function updateTableOfContents(editor: vscode.TextEditor): Promise<void> {
	const document = editor.document;
	const bookmarks = await getBookmarks();

	const edit = new vscode.WorkspaceEdit();
	const firstLine = document.lineAt(0);
	const startPos = new vscode.Position(0, 0);
	const endPos = new vscode.Position(firstLine.range.end.line, firstLine.range.end.character);

	const bookmarkText = bookmarks
		.map((bookmark) => document.getText(bookmark).trim())
		.join('\n');

	edit.insert(document.uri, startPos, bookmarkText);
	await vscode.workspace.applyEdit(edit);
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "bookmarks-toc-gen" is now active!');

	let appendBookmarksDisposable = vscode.commands.registerTextEditorCommand('bookmarks-toc-gen.updateTableOfContents', (editor) => {
		updateTableOfContents(editor);
	});

	context.subscriptions.push(appendBookmarksDisposable);
}

export function deactivate() { }
