import * as vscode from 'vscode';
import * as path from 'path';
import { getAuthToken } from '../auth';
import { generateTests } from '../testGeneration';
import { generateIntegrationTests } from '../integrationTestGeneration';
import { getNonce, getExtensionContext } from '../utils';
import { analyzeCoverage, CoverageAnalysisResponse } from '../coverageAnalysis';

export class DevexySidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devexy.sidebar';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _channel: vscode.OutputChannel;
    private _selectedSourceFiles: vscode.Uri[] = [];
    private _selectedTestFiles: vscode.Uri[] = [];
    
    constructor(extensionUri: vscode.Uri, channel: vscode.OutputChannel) {
        this._extensionUri = extensionUri;
        this._channel = channel;
    }
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from specific directories
            localResourceRoots: [
                this._extensionUri
            ]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'login':
                    this._log('User initiated login');
                    await this._login(message.username, message.password);
                    return;
                
                case 'generateTests':
                    this._log(`User initiated ${message.testType || 'unit'} test generation`);
                    await this._generateTests(message.testDir, message.testType || 'unit');
                    return;
                    
                case 'checkLoginStatus':
                    await this._checkLoginStatus();
                    return;
                
                case 'logOutput':
                    this._log(message.text);
                    return;
                    
                case 'applyTests':
                    this._log('Applying generated tests');
                    await vscode.commands.executeCommand('devexy.applyTests', message.tests);
                    return;
                    
                case 'previewTest':
                    this._log(`Previewing test: ${message.test.filepath}`);
                    await vscode.commands.executeCommand('devexy.previewTest', message.test);
                    return;

                case 'selectSourceFiles':
                    await this._selectSourceFiles();
                    return;
                    
                case 'selectTestFiles':
                    await this._selectTestFiles();
                    return;
                    
                case 'analyzeCoverage':
                    await this._analyzeCoverage();
                    return;
                    
                case 'closeCoverageResults':
                    this._view?.webview.postMessage({
                        command: 'hideCoverageResults'
                    });
                    return;
            }
        });
        
        // Check login status when sidebar loads
        this._checkLoginStatus();
    }
    
    private async _login(username: string, password: string) {
        try {
            // Update UI to loading state
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'loading',
                action: 'login',
                message: 'Logging in...' 
            });
            
            // Attempt to log in
            const context = getExtensionContext();
            
            // Get login credentials
            if (!username) {
                throw new Error('Username is required');
            }
            
            if (!password) {
                throw new Error('Password is required');
            }
            
            try {
                // Import required module inside the function to avoid circular dependencies
                const { login } = require('../auth');
                
                // Login with credentials
                await login(context, username, password);
                
                // Update UI to success state
                this._view?.webview.postMessage({ 
                    command: 'updateStatus',
                    status: 'success',
                    action: 'login',
                    message: 'Successfully logged in' 
                });
                
                this._log('Login successful');
            } catch (error: any) {
                this._log(`Login error: ${error.message || 'Unknown error'}`);
                
                // Update UI to error state
                this._view?.webview.postMessage({ 
                    command: 'updateStatus',
                    status: 'error',
                    action: 'login',
                    message: `Login failed: ${error.response?.data?.detail || error.message || 'Unknown error'}`
                });
                
                throw error;
            }
        } catch (error: any) {
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'error',
                action: 'login',
                message: `Login failed: ${error.message || 'Unknown error'}`
            });
        }
    }
    
    private async _generateTests(testDir?: string, testType: 'unit' | 'integration' = 'unit') {
        try {
            // Update UI to loading state
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'loading',
                action: 'generateTests',
                message: `Preparing ${testType} test generation...` 
            });
            
            // Get context for token
            const context = getExtensionContext();
            
            // Get files to process
            const files = await this._getFilesToProcess();
            
            if (files.length === 0) {
                this._view?.webview.postMessage({ 
                    command: 'updateStatus',
                    status: 'error',
                    action: 'generateTests',
                    message: 'No files selected for test generation'
                });
                return;
            }
            
            // Update message
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'loading',
                action: 'generateTests',
                message: `Generating ${testType} tests for ${files.length} file(s)...` 
            });
            
            const testDirDefault = testDir || 'tests';
            
            let results;
            
            // Run test generation based on type
            if (testType === 'integration') {
                results = await generateIntegrationTests(context, files, testDirDefault, (progress: string) => {
                    // Pass progress updates to the webview
                    this._view?.webview.postMessage({ 
                        command: 'updateProgress',
                        action: 'generateTests',
                        message: progress
                    });
                    
                    this._log(progress);
                });
            } else {
                // Default to unit test generation
                results = await generateTests(context, files, testDirDefault, (progress: string) => {
                    // Pass progress updates to the webview
                    this._view?.webview.postMessage({ 
                        command: 'updateProgress',
                        action: 'generateTests',
                        message: progress
                    });
                    
                    this._log(progress);
                });
            }
            
            // Update UI to success state
            this._view?.webview.postMessage({ 
                command: 'updateTestResults',
                status: 'success',
                tests: results
            });
            
            this._log(`Generated ${results.length} ${testType} test file(s)`);
            
        } catch (error: any) {
            this._log(`Test generation error: ${error.message || 'Unknown error'}`);
            
            // Update UI to error state
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'error',
                action: 'generateTests',
                message: `Test generation failed: ${error.message || 'Unknown error'}`
            });
        }
    }
    
    private async _checkLoginStatus() {
        try {
            const context = getExtensionContext();
            // Import isLoggedIn to avoid circular dependencies
            const { isLoggedIn } = require('../auth');
            const loggedIn = await isLoggedIn(context);
            
            this._view?.webview.postMessage({ 
                command: 'loginStatus',
                isLoggedIn: loggedIn
            });
        } catch (error) {
            this._log('Error checking login status');
            this._view?.webview.postMessage({ 
                command: 'loginStatus',
                isLoggedIn: false
            });
        }
    }
    
    private async _getFilesToProcess(): Promise<vscode.Uri[]> {
        // Check if there are files selected in the explorer
        const selectedFiles = this._getSelectedFilesFromExplorer();
        
        if (selectedFiles && selectedFiles.length > 0) {
            return selectedFiles;
        }
    
        // If no files are selected, show file picker
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Select Files for Test Generation',
            filters: {
                'All Files': ['*']
            }
        });
    
        return files || [];
    }
    
    private _getSelectedFilesFromExplorer(): vscode.Uri[] | undefined {
        if (vscode.window.activeTextEditor) {
            return [vscode.window.activeTextEditor.document.uri];
        }
        return undefined;
    }
    
    private _log(message: string) {
        this._channel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
    
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script run in the webview, then convert to webview URI
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js'));
        
        // Same for CSS file
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css'));
        
        // Get logo
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'logo.png'));
        
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
            <link href="${styleMainUri}" rel="stylesheet">
            <title>DevExy</title>
        </head>
        <body>
            <header>
                <div class="logo-container">
                    <img src="${logoUri}" alt="DevExy Logo" class="logo">
                    <h1>DevExy</h1>
                </div>
            </header>
            
            <section id="status-section">
                <div id="login-status">
                    <span class="status-indicator offline"></span>
                    <span class="status-text">Not logged in</span>
                </div>
            </section>
            
            <section id="login-section" class="panel">
                <h2>Login</h2>
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" placeholder="Enter your username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter your password">
                </div>
                <div id="login-status-message" class="status-message"></div>
                <button id="login-button" class="primary-button">Login</button>
            </section>
            
            <section id="generate-tests-section" class="panel">
                <h2>Generate Tests</h2>
                <p class="info-text">Generate unit, integration, or stress tests for selected files or the current file.</p>
                <div class="form-group">
                    <label for="test-directory">Test Directory</label>
                    <input type="text" id="test-directory" value="tests" placeholder="tests">
                </div>
                <div id="test-status-message" class="status-message"></div>
                <div class="button-group">
                    <button id="generate-unit-button" class="primary-button">Unit Tests</button>
                    <button id="generate-integration-button" class="primary-button">Integration Tests</button>
                    <button id="generate-stress-button" class="primary-button">Stress Tests</button>
                </div>
            </section>
            
            <section id="coverage-analysis-section" class="panel">
                <h2>Coverage Analysis</h2>
                <p class="info-text">Analyze test coverage by selecting source files and their corresponding test files.</p>
                <div class="form-group">
                    <button id="select-source-files-button" class="secondary-button">Select Source Files</button>
                    <div id="source-files-list" class="files-list">
                        <p class="info-text">No source files selected</p>
                    </div>
                </div>
                <div class="form-group">
                    <button id="select-test-files-button" class="secondary-button">Select Test Files</button>
                    <div id="test-files-list" class="files-list">
                        <p class="info-text">No test files selected</p>
                    </div>
                </div>
                <div id="coverage-status-message" class="status-message"></div>
                <div class="button-group">
                    <button id="analyze-coverage-button" class="primary-button">Analyze Coverage</button>
                </div>
            </section>
            
            <section id="coverage-results-section" class="panel hidden">
                <h2>Coverage Results</h2>
                <div id="coverage-summary" class="coverage-summary"></div>
                <div id="coverage-recommendations" class="coverage-recommendations"></div>
                <div id="coverage-visualization" class="coverage-visualization"></div>
                <div id="files-analysis" class="files-analysis"></div>
                <div class="button-group">
                    <button id="close-coverage-button" class="secondary-button">Close</button>
                </div>
            </section>
            
            <section id="test-results-section" class="panel hidden">
                <h2>Test Results</h2>
                <div id="test-results-list"></div>
                <div class="button-group">
                    <button id="apply-button" class="primary-button">Apply Tests</button>
                    <button id="cancel-button" class="secondary-button">Cancel</button>
                </div>
            </section>
            
            <footer>
                <div class="version">v0.0.1</div>
            </footer>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private async _selectSourceFiles() {
        try {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: true,
                openLabel: 'Select Source Files',
                filters: {
                    'Source Files': ['js', 'ts', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'php']
                }
            });
            
            if (files && files.length > 0) {
                this._selectedSourceFiles = files;
                
                // Send selected files to webview
                this._view?.webview.postMessage({
                    command: 'updateSourceFiles',
                    files: files.map(f => vscode.workspace.asRelativePath(f))
                });
                
                this._log(`Selected ${files.length} source files for coverage analysis`);
            }
        } catch (error) {
            this._log(`Error selecting source files: ${error}`);
        }
    }
    
    private async _selectTestFiles() {
        try {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: true,
                openLabel: 'Select Test Files',
                filters: {
                    'Test Files': ['js', 'ts', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'php']
                }
            });
            
            if (files && files.length > 0) {
                this._selectedTestFiles = files;
                
                // Send selected files to webview
                this._view?.webview.postMessage({
                    command: 'updateTestFiles',
                    files: files.map(f => vscode.workspace.asRelativePath(f))
                });
                
                this._log(`Selected ${files.length} test files for coverage analysis`);
            }
        } catch (error) {
            this._log(`Error selecting test files: ${error}`);
        }
    }
    
    private async _analyzeCoverage() {
        try {
            // Check if files are selected
            if (this._selectedSourceFiles.length === 0) {
                this._view?.webview.postMessage({
                    command: 'showError',
                    action: 'coverage',
                    message: 'Please select source files for coverage analysis'
                });
                return;
            }
            
            if (this._selectedTestFiles.length === 0) {
                this._view?.webview.postMessage({
                    command: 'showError',
                    action: 'coverage',
                    message: 'Please select test files for coverage analysis'
                });
                return;
            }
            
            // Update UI to loading state
            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'loading',
                action: 'coverage',
                message: 'Analyzing test coverage...'
            });
            
            // Get coverage analysis
            const context = getExtensionContext();
            const results = await analyzeCoverage(
                context,
                this._selectedSourceFiles,
                this._selectedTestFiles,
                (progress: string) => {
                    // Pass progress updates to the webview
                    this._view?.webview.postMessage({
                        command: 'updateProgress',
                        action: 'coverage',
                        message: progress
                    });
                    
                    this._log(progress);
                }
            );
            
            // Update UI with results
            this._view?.webview.postMessage({
                command: 'updateCoverageResults',
                results: results
            });
            
            this._log('Coverage analysis completed successfully');
            
        } catch (error: any) {
            this._log(`Coverage analysis error: ${error.message || 'Unknown error'}`);
            
            // Update UI to error state
            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'error',
                action: 'coverage',
                message: `Coverage analysis failed: ${error.message || 'Unknown error'}`
            });
        }
    }
}