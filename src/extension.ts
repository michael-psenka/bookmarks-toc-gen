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

// Function of great value
async function updateTableOfContents(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    const bookmarks = await getBookmarks();

    const edit = new vscode.WorkspaceEdit();

    // Find the start and end lines of the table of contents
    let startLine = -1;
    let endLine = -1;
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.text === '*********') {
            if (startLine === -1) {
                startLine = i;
            } else {
                endLine = i;
                break;
            }
        }
    }

    // If the table of contents exists, delete it

    if (startLine !== -1 && endLine !== -1) {
        edit.delete(document.uri, new vscode.Range(startLine + 1, 0, endLine, 0));
        edit.insert(document.uri, new vscode.Position(endLine, 0), '\n');
    }

	// now we need to account for the difference in how long the TOC was before vs. how
	// long it will be now after the update
	const bibChangeOffset = bookmarks.length - (endLine - startLine - 1);

    // Insert the new table of contents
    const tocLines = [];
    tocLines.push('*********');
    for (const bookmark of bookmarks) {
        const line = document.lineAt(bookmark+1);
		// note that line numbers in bookmark are 0-indexed. and as described before,
		// we need to account for the lines we are now potentially creating for the table of contents
        tocLines.push(`${bookmark+1+bibChangeOffset}: ${line.text}`);
    }
    tocLines.push('*********');
    // edit.insert(document.uri, new vscode.Position(0, 0), tocLines.join('\n'));

    await vscode.workspace.applyEdit(edit);
	// finally, comment out the table of contents
	const startLineComment = document.lineAt(0);
    const endLineComment = document.lineAt(5);
    // vscode.commands.executeCommand('editor.action.commentLine');
    editor.selection = new vscode.Selection(startLineComment.range.start, endLineComment.range.end);
    await vscode.commands.executeCommand('editor.action.commentLine');

}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "bookmarks-toc-gen" is now active!');

	let appendBookmarksDisposable = vscode.commands.registerTextEditorCommand('bookmarks-toc-gen.updateTableOfContents', (editor) => {
		updateTableOfContents(editor);
	});

	context.subscriptions.push(appendBookmarksDisposable);
}

export function deactivate() { }

