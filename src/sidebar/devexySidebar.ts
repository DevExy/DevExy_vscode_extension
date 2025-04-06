import * as vscode from 'vscode';
import * as path from 'path';
import axios from 'axios';
import { getAuthToken } from '../auth';
import { generateTests } from '../testGeneration';
import { generateIntegrationTests } from '../integrationTestGeneration';
import { getNonce, getExtensionContext } from '../utils';
import { analyzeCoverage, CoverageAnalysisResponse } from '../coverageAnalysis';
import { analyzeTestPriority, TestPriorityAnalysisResponse } from '../testPriorityAnalysis';

export class DevexySidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devexy.sidebar';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _channel: vscode.OutputChannel;
    private _selectedSourceFiles: vscode.Uri[] = [];
    private _selectedTestFiles: vscode.Uri[] = [];
    private _selectedSourceFilesForRequirements: vscode.Uri[] = [];
    private _criticalityContext: string = "";
    private _selectedRequirementsFile: vscode.Uri | null = null;
    private _requirementsContent: string = "";

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
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
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

                case 'analyzeTestPriority':
                    await this._analyzeTestPriority();
                    return;

                case 'updateCriticalityContext':
                    this._criticalityContext = message.context;
                    return;

                case 'closeCoverageResults':
                    this._view?.webview.postMessage({
                        command: 'hideCoverageResults'
                    });
                    return;

                case 'closePriorityResults':
                    this._view?.webview.postMessage({
                        command: 'hidePriorityResults'
                    });
                    return;

                case 'downloadCoverageReport':
                    await this._generatePdfReport();
                    return;

                case 'selectRequirementsFile':
                    await this._selectRequirementsFile();
                    break;

                case 'selectSourceFilesForRequirements':
                    await this._selectSourceFilesForRequirements();
                    break;

                case 'analyzeRequirements':
                    await this._analyzeRequirements(message.description || 'Analyze requirements file');
                    break;

                case 'optimizeRequirements':
                    await this._optimizeRequirements(
                        message.goals || ['memory', 'performance', 'security'],
                        message.keepDependencies || [],
                        message.description || 'Optimize requirements file'
                    );
                    break;

                case 'closeRequirementsAnalysis':
                    webviewView.webview.postMessage({ command: 'hideRequirementsAnalysisResults' });
                    break;

                case 'closeRequirementsOptimization':
                    webviewView.webview.postMessage({ command: 'hideRequirementsOptimizationResults' });
                    break;

                case 'copyToClipboard':
                    if (message.content) {
                        await vscode.env.clipboard.writeText(message.content);
                        webviewView.webview.postMessage({ command: 'clipboardSuccess' });
                    }
                    break;

                case 'saveOptimizedRequirements':
                    if (message.content) {
                        const saveUri = await vscode.window.showSaveDialog({
                            filters: {
                                'Requirements Files': ['txt', 'requirements']
                            },
                            saveLabel: 'Save Optimized Requirements'
                        });

                        if (saveUri) {
                            const data = Buffer.from(message.content, 'utf8');
                            await vscode.workspace.fs.writeFile(saveUri, data);
                            vscode.window.showInformationMessage(`Requirements saved to ${saveUri.fsPath}`);
                        }
                    }
                    break;
            }
        });

        this._checkLoginStatus();
    }

    public refreshLoginStatus() {
        this._checkLoginStatus();
    }

    private async _login(username: string, password: string) {
        try {
            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'loading',
                action: 'login',
                message: 'Logging in...'
            });

            const context = getExtensionContext();

            if (!username) {
                throw new Error('Username is required');
            }

            if (!password) {
                throw new Error('Password is required');
            }

            try {
                const { login } = require('../auth');
                await login(context, username, password);

                this._view?.webview.postMessage({
                    command: 'updateStatus',
                    status: 'success',
                    action: 'login',
                    message: 'Successfully logged in'
                });

                this._log('Login successful');
            } catch (error: any) {
                this._log(`Login error: ${error.message || 'Unknown error'}`);

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
            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'loading',
                action: 'generateTests',
                message: `Preparing ${testType} test generation...`
            });

            const context = getExtensionContext();
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

            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'loading',
                action: 'generateTests',
                message: `Generating ${testType} tests for ${files.length} file(s)...`
            });

            const testDirDefault = testDir || 'tests';

            let results;

            if (testType === 'integration') {
                results = await generateIntegrationTests(context, files, testDirDefault, (progress: string) => {
                    this._view?.webview.postMessage({
                        command: 'updateProgress',
                        action: 'generateTests',
                        message: progress
                    });

                    this._log(progress);
                });
            } else {
                results = await generateTests(context, files, testDirDefault, (progress: string) => {
                    this._view?.webview.postMessage({
                        command: 'updateProgress',
                        action: 'generateTests',
                        message: progress
                    });

                    this._log(progress);
                });
            }

            this._view?.webview.postMessage({
                command: 'updateTestResults',
                status: 'success',
                tests: results
            });

            this._log(`Generated ${results.length} ${testType} test file(s)`);

        } catch (error: any) {
            this._log(`Test generation error: ${error.message || 'Unknown error'}`);

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
            const { isLoggedIn, getUsername } = require('../auth');
            const loggedIn = await isLoggedIn(context);
            const username = loggedIn ? await getUsername(context) : null;
            
            this._view?.webview.postMessage({ 
                command: 'loginStatus',
                isLoggedIn: loggedIn,
                username: username
            });

            // If we're not logged in anymore, make sure UI fully resets
            if (!loggedIn) {
                this._view?.webview.postMessage({
                    command: 'updateAuthStatus',
                    isLoggedIn: false
                });
            }
        } catch (error) {
            this._log('Error checking login status');
            this._view?.webview.postMessage({
                command: 'loginStatus',
                isLoggedIn: false
            });
        }
    }

    private async _getFilesToProcess(): Promise<vscode.Uri[]> {
        const selectedFiles = this._getSelectedFilesFromExplorer();

        if (selectedFiles && selectedFiles.length > 0) {
            return selectedFiles;
        }

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

            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'loading',
                action: 'coverage',
                message: 'Analyzing test coverage...'
            });

            const context = getExtensionContext();
            const results = await analyzeCoverage(
                context,
                this._selectedSourceFiles,
                this._selectedTestFiles,
                (progress: string) => {
                    this._view?.webview.postMessage({
                        command: 'updateProgress',
                        action: 'coverage',
                        message: progress
                    });

                    this._log(progress);
                }
            );

            this._view?.webview.postMessage({
                command: 'updateCoverageResults',
                results: results
            });

            this._log('Coverage analysis completed successfully');

        } catch (error: any) {
            this._log(`Coverage analysis error: ${error.message || 'Unknown error'}`);

            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'error',
                action: 'coverage',
                message: `Coverage analysis failed: ${error.message || 'Unknown error'}`
            });
        }
    }

    private async _analyzeTestPriority() {
        try {
            // Check if files are selected
            if (this._selectedSourceFiles.length === 0) {
                this._view?.webview.postMessage({
                    command: 'showError',
                    action: 'priority',
                    message: 'Please select source files for test priority analysis'
                });
                return;
            }
            
            if (this._selectedTestFiles.length === 0) {
                this._view?.webview.postMessage({
                    command: 'showError',
                    action: 'priority',
                    message: 'Please select test files for test priority analysis'
                });
                return;
            }
            
            // Update UI to loading state
            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'loading',
                action: 'priority',
                message: 'Analyzing test priorities and risks...'
            });
            
            // Get test priority analysis
            const context = getExtensionContext();
            const results = await analyzeTestPriority(
                context,
                this._selectedSourceFiles,
                this._selectedTestFiles,
                this._criticalityContext,
                (progress: string) => {
                    // Pass progress updates to the webview
                    this._view?.webview.postMessage({
                        command: 'updateProgress',
                        action: 'priority',
                        message: progress
                    });
                    
                    this._log(progress);
                }
            );
            
            // Update UI with results
            this._view?.webview.postMessage({
                command: 'updatePriorityResults',
                results: results
            });
            
            this._log('Test priority analysis completed successfully');
            
        } catch (error: any) {
            this._log(`Test priority analysis error: ${error.message || 'Unknown error'}`);
            
            // Update UI to error state
            this._view?.webview.postMessage({
                command: 'updateStatus',
                status: 'error',
                action: 'priority',
                message: `Test priority analysis failed: ${error.message || 'Unknown error'}`
            });
        }
    }

    private async _generatePdfReport() {
        try {
            this._log('Generating PDF report...');

            this._view?.webview.postMessage({
                command: 'updateStatus',
                action: 'coverage',
                status: 'loading',
                message: 'Generating PDF report...'
            });

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const context = getExtensionContext();
            const token = await getAuthToken(context);

            const date = new Date().toISOString().split('T')[0];
            const filename = `coverage-report-${date}.pdf`;
            const reportPath = path.join(workspaceFolder.uri.fsPath, filename);

            const fs = require('fs');
            const reportContent = Buffer.from(`
                Coverage Report
                Generated on ${new Date().toLocaleString()}
                This is a placeholder PDF file.
                Actual implementation would generate a proper PDF with charts and tables.
            `);

            fs.writeFileSync(reportPath, reportContent);

            const doc = await vscode.workspace.openTextDocument(reportPath);
            await vscode.window.showTextDocument(doc);

            this._view?.webview.postMessage({
                command: 'reportDownloaded',
                path: reportPath
            });

            this._log(`PDF report generated and saved to ${reportPath}`);

        } catch (error) {
            this._log(`Error generating PDF report: ${error}`);

            this._view?.webview.postMessage({
                command: 'reportDownloadError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async _selectRequirementsFile() {
        try {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Select Requirements File',
                filters: {
                    'Requirements Files': ['txt', 'pip', 'requirements']
                }
            });

            if (files && files.length > 0) {
                const fileUri = files[0];
                this._selectedRequirementsFile = fileUri;
                
                const content = await vscode.workspace.fs.readFile(fileUri);
                this._requirementsContent = Buffer.from(content).toString('utf8');
                
                this._view?.webview.postMessage({
                    command: 'updateRequirementsFile',
                    filepath: vscode.workspace.asRelativePath(fileUri),
                    content: this._requirementsContent
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error selecting requirements file: ${error}`);
        }
    }

    private async _selectSourceFilesForRequirements() {
        try {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: true,
                openLabel: 'Select Source Files for Requirements Analysis',
                filters: {
                    'Source Files': ['py', 'js', 'ts', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'php']
                }
            });

            if (files && files.length > 0) {
                this._selectedSourceFilesForRequirements = files;
                
                const filePaths = files.map(file => vscode.workspace.asRelativePath(file));
                
                this._view?.webview.postMessage({
                    command: 'updateSourceFilesForRequirements',
                    files: filePaths
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error selecting source files: ${error}`);
        }
    }

    private async _analyzeRequirements(description: string) {
        if (!this._selectedRequirementsFile) {
            vscode.window.showErrorMessage('Please select a requirements file first');
            this._view?.webview.postMessage({
                command: 'updateRequirementsAnalysisStatus',
                status: 'error',
                message: 'Please select a requirements file first'
            });
            return;
        }
        
        try {
            this._view?.webview.postMessage({
                command: 'updateRequirementsAnalysisStatus',
                status: 'loading',
                message: 'Analyzing requirements file...'
            });
            
            // Prepare source files content
            const sourceFilesContent = await Promise.all(
                this._selectedSourceFilesForRequirements.map(async (file) => {
                    const content = await vscode.workspace.fs.readFile(file);
                    return {
                        filepath: vscode.workspace.asRelativePath(file),
                        content: Buffer.from(content).toString('utf8')
                    };
                })
            );
            
            // Get the token from context
            const token = await getAuthToken(getExtensionContext());
            if (!token) {
                throw new Error('Authentication required. Please log in.');
            }
            
            // Prepare request data
            const requestData = {
                requirements_content: {
                    content: this._requirementsContent,
                    filepath: vscode.workspace.asRelativePath(this._selectedRequirementsFile)
                },
                source_files: sourceFilesContent.length > 0 ? sourceFilesContent : undefined,
                description: description
            };
            
            // Make API request
            const response = await axios.post(
                'https://devexy-backend.azurewebsites.net/requirements/analyze',
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000  // 30 seconds timeout
                }
            );
            
            // Send results to webview
            this._view?.webview.postMessage({
                command: 'requirementsAnalysisResults',
                results: response.data
            });
            
        } catch (error) {
            let errorMessage = 'Failed to analyze requirements file';
            if (axios.isAxiosError(error)) {
                errorMessage = error.response?.data?.detail || error.message;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            this._view?.webview.postMessage({
                command: 'updateRequirementsAnalysisStatus',
                status: 'error',
                message: errorMessage
            });
        }
    }

    private async _optimizeRequirements(goals: string[], keepDependencies: string[], description: string) {
        if (!this._selectedRequirementsFile) {
            vscode.window.showErrorMessage('Please select a requirements file first');
            this._view?.webview.postMessage({
                command: 'updateRequirementsOptimizationStatus',
                status: 'error',
                message: 'Please select a requirements file first'
            });
            return;
        }
        
        try {
            this._view?.webview.postMessage({
                command: 'updateRequirementsOptimizationStatus',
                status: 'loading',
                message: 'Optimizing requirements file...'
            });
            
            // Prepare source files content
            const sourceFilesContent = await Promise.all(
                this._selectedSourceFilesForRequirements.map(async (file) => {
                    const content = await vscode.workspace.fs.readFile(file);
                    return {
                        filepath: vscode.workspace.asRelativePath(file),
                        content: Buffer.from(content).toString('utf8')
                    };
                })
            );
            
            // Get the token from context
            const token = await getAuthToken(getExtensionContext());
            if (!token) {
                throw new Error('Authentication required. Please log in.');
            }
            
            // Prepare request data
            const requestData = {
                requirements_content: {
                    content: this._requirementsContent,
                    filepath: vscode.workspace.asRelativePath(this._selectedRequirementsFile)
                },
                source_files: sourceFilesContent.length > 0 ? sourceFilesContent : undefined,
                optimization_goals: goals,
                keep_dependencies: keepDependencies.length > 0 ? keepDependencies : undefined,
                description: description
            };
            
            // Make API request
            const response = await axios.post(
                'https://devexy-backend.azurewebsites.net/requirements/optimize',
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000  // 30 seconds timeout
                }
            );
            
            // Send results to webview
            this._view?.webview.postMessage({
                command: 'requirementsOptimizationResults',
                results: response.data
            });
            
        } catch (error) {
            let errorMessage = 'Failed to optimize requirements file';
            if (axios.isAxiosError(error)) {
                errorMessage = error.response?.data?.detail || error.message;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            this._view?.webview.postMessage({
                command: 'updateRequirementsOptimizationStatus',
                status: 'error',
                message: errorMessage
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'logo.png'));
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
            
            <section id="test-analysis-section" class="panel">
                <h2>Test Analysis</h2>
                <p class="info-text">Analyze test coverage and test priorities by selecting source files and their corresponding test files.</p>
                
                <!-- Shared file selection controls -->
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
                
                <!-- Coverage Analysis subsection -->
                <div class="analysis-subsection">
                    <h3>Coverage Analysis</h3>
                    <div id="coverage-status-message" class="status-message"></div>
                    <div class="button-group">
                        <button id="analyze-coverage-button" class="primary-button">Analyze Coverage</button>
                    </div>
                </div>
                
                <!-- Test Priority Analysis subsection -->
                <div class="analysis-subsection">
                    <h3>Test Priority Analysis</h3>
                    <div class="form-group">
                        <label for="criticality-context">Code Criticality Context (Optional)</label>
                        <textarea id="criticality-context" placeholder="Describe critical aspects of your code (e.g., payment processing, user data handling)"></textarea>
                    </div>
                    <div id="priority-status-message" class="status-message"></div>
                    <div class="button-group">
                        <button id="analyze-priority-button" class="primary-button">Analyze Test Priorities</button>
                    </div>
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
            
            <section id="priority-results-section" class="panel hidden">
                <h2>Test Priority Results</h2>
                <div id="priority-summary" class="priority-summary"></div>
                <div id="test-priorities" class="test-priorities"></div>
                <div id="security-vulnerabilities" class="security-vulnerabilities"></div>
                <div id="priority-visualization" class="priority-visualization"></div>
                <div id="priority-recommendations" class="priority-recommendations"></div>
                <div class="button-group">
                    <button id="close-priority-button" class="secondary-button">Close</button>
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
            
            <section id="requirements-section" class="panel">
                <h2>Requirements Management</h2>
                <p class="info-text">Analyze and optimize your Python requirements file to improve performance and memory usage.</p>
                
                <div class="form-group">
                    <button id="select-requirements-file-button" class="secondary-button">Select Requirements File</button>
                    <div id="requirements-file-info" class="file-info">No requirements file selected</div>
                </div>
                
                <div class="form-group">
                    <button id="select-source-files-for-requirements-button" class="secondary-button">Select Source Files (Optional)</button>
                    <div id="source-files-for-requirements-list" class="files-list">
                        <p class="info-text">No source files selected</p>
                    </div>
                </div>
                
                <div id="requirements-analysis-subsection" class="analysis-subsection">
                    <h3>Requirements Analysis</h3>
                    <div class="form-group">
                        <label for="requirements-analysis-description">Analysis Description (Optional)</label>
                        <input type="text" id="requirements-analysis-description" placeholder="Analyze requirements file for performance and memory usage">
                    </div>
                    <div id="requirements-analysis-status-message" class="status-message"></div>
                    <div class="button-group">
                        <button id="analyze-requirements-button" class="primary-button">Analyze Requirements</button>
                    </div>
                </div>
                
                <div id="requirements-optimization-subsection" class="analysis-subsection">
                    <h3>Requirements Optimization</h3>
                    <div class="form-group">
                        <label>Optimization Goals</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="optimization-goal" value="memory" checked> Memory Usage
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="optimization-goal" value="performance" checked> Performance
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="optimization-goal" value="security" checked> Security
                            </label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="keep-dependencies">Keep Dependencies (comma-separated)</label>
                        <input type="text" id="keep-dependencies" placeholder="fastapi, requests, ...">
                    </div>
                    <div class="form-group">
                        <label for="requirements-optimization-description">Optimization Description (Optional)</label>
                        <input type="text" id="requirements-optimization-description" placeholder="Optimize for better performance and memory usage">
                    </div>
                    <div id="requirements-optimization-status-message" class="status-message"></div>
                    <div class="button-group">
                        <button id="optimize-requirements-button" class="primary-button">Optimize Requirements</button>
                    </div>
                </div>
            </section>
            
            <section id="requirements-analysis-results-section" class="panel hidden">
                <h2>Requirements Analysis Results</h2>
                <div id="requirements-summary" class="requirements-summary"></div>
                <div id="dependencies-list" class="dependencies-list"></div>
                <div id="performance-impact" class="performance-impact"></div>
                <div id="memory-impact" class="memory-impact"></div>
                <div id="security-concerns" class="security-concerns"></div>
                <div id="optimization-opportunities" class="optimization-opportunities"></div>
                <div id="requirements-visualizations" class="requirements-visualizations"></div>
                <div class="button-group">
                    <button id="close-requirements-analysis-button" class="secondary-button">Close</button>
                </div>
            </section>
            
            <section id="requirements-optimization-results-section" class="panel hidden">
                <h2>Requirements Optimization Results</h2>
                <div id="optimization-summary" class="optimization-summary"></div>
                <div class="form-group">
                    <label for="optimized-content">Optimized Requirements</label>
                    <div class="code-container">
                        <pre id="optimized-content" class="code-block"></pre>
                        <button id="copy-optimized-content-button" class="icon-button" title="Copy to clipboard">
                            <span class="copy-icon">📋</span>
                        </button>
                    </div>
                </div>
                <div id="optimization-changes" class="optimization-changes"></div>
                <div id="optimization-improvements" class="optimization-improvements"></div>
                <div id="optimization-recommendations" class="optimization-recommendations"></div>
                <div class="button-group">
                    <button id="save-optimized-requirements-button" class="primary-button">Save to File</button>
                    <button id="close-requirements-optimization-button" class="secondary-button">Close</button>
                </div>
            </section>
            
            <footer>
                <div class="version">v0.0.1</div>
            </footer>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}