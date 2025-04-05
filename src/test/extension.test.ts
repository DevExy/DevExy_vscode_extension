import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Extension Test Suite', () => {
    // Runs before all tests
    suiteSetup(async function() {
        this.timeout(10000); // 10 seconds to set up tests
        vscode.window.showInformationMessage('Starting extension tests...');
    });
    
    // Runs after all tests
    suiteTeardown(() => {
        vscode.window.showInformationMessage('All tests complete!');
    });
    
    test('Extension should be active', async () => {
        const extension = vscode.extensions.getExtension('devexy');
        assert.notStrictEqual(extension, undefined, 'Extension should be available');
        
        if (extension) {
            if (!extension.isActive) {
                await extension.activate();
            }
            assert.strictEqual(extension.isActive, true, 'Extension should be active');
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        // Check if our commands are registered
        assert.ok(commands.includes('devexy.helloWorld'), 'Hello World command should be registered');
        assert.ok(commands.includes('devexy.login'), 'Login command should be registered');
        assert.ok(commands.includes('devexy.generateTests'), 'Generate Tests command should be registered');
    });
    
    test('Sample array test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
        assert.strictEqual(1, [1, 2, 3].indexOf(2));
    });
    
    test('Test directory creation', async function() {
        this.timeout(5000); // 5 seconds for file operations
        
        // Get workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.skip(); // Skip test if no workspace folder
            return;
        }
        
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const testDirPath = path.join(workspaceRoot, 'tests', 'testdir');
        const testFilePath = path.join(testDirPath, 'testfile.txt');
        
        // Ensure clean state
        try {
            if (fs.existsSync(testDirPath)) {
                fs.rmdirSync(testDirPath, { recursive: true });
            }
        } catch (err) {
            // Ignore errors during cleanup
        }
        
        // Create directory and test file
        try {
            // Use the same method as our extension to create directory
            await new Promise<void>((resolve, reject) => {
                fs.mkdir(testDirPath, { recursive: true }, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            // Write a test file
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(testFilePath),
                new TextEncoder().encode('Test content')
            );
            
            // Verify file exists
            assert.strictEqual(fs.existsSync(testFilePath), true, 'Test file should exist');
            
            // Read file back
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(testFilePath));
            assert.strictEqual(
                new TextDecoder().decode(content),
                'Test content',
                'File content should match what was written'
            );
        } finally {
            // Clean up
            try {
                if (fs.existsSync(testDirPath)) {
                    fs.rmdirSync(testDirPath, { recursive: true });
                }
            } catch (err) {
                // Ignore errors during cleanup
            }
        }
    });
});
