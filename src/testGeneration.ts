import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { getAuthToken } from './auth';

// Types for API communication
interface FileContent {
    filepath: string;
    content: string;
}

interface TestGenerationRequest {
    files: FileContent[];
    description?: string;
    test_directory: string;
}

export interface GeneratedTest {
    filepath: string;
    content: string;
}

interface TestGenerationResponse {
    tests: GeneratedTest[];
    message: string;
}

export async function generateTests(
    context: vscode.ExtensionContext,
    files: vscode.Uri[],
    testDirectory: string,
    progressCallback: (message: string) => void
): Promise<GeneratedTest[]> {
    // Get authentication token
    const token = await getAuthToken(context);
    
    // Prepare files content
    progressCallback('Preparing files...');
    
    const fileContents: FileContent[] = await Promise.all(files.map(async (file) => {
        const relativePath = vscode.workspace.asRelativePath(file);
        const content = await readFileContent(file);
        
        return {
            filepath: relativePath,
            content: content
        };
    }));

    // Check if we have too many files or too much content
    const totalContentSize = fileContents.reduce((acc, file) => acc + file.content.length, 0);
    if (fileContents.length > 10 || totalContentSize > 500000) { // 500KB total limit
        const continueAnyway = await vscode.window.showWarningMessage(
            `You're trying to process ${fileContents.length} files with a total of ${Math.round(totalContentSize/1024)}KB of content. This might take longer than expected or time out.`,
            'Continue Anyway',
            'Cancel'
        );
        
        if (continueAnyway !== 'Continue Anyway') {
            throw new Error('Operation cancelled by user');
        }
    }

    // Prepare request data
    const requestData: TestGenerationRequest = {
        files: fileContents,
        description: "Generate comprehensive unit tests following best practices: use proper assertions, test edge cases, include setup/teardown if needed, use mocks for dependencies, ensure high test coverage, and follow naming conventions.",
        test_directory: testDirectory
    };

    // Create progress updates
    const progressMessages = [
        'Analyzing code structure...',
        'Identifying testable components...',
        'Designing test cases...',
        'Generating test code...',
        'Still working on tests...',
        'This is taking longer than expected, but still working...',
        'Finalizing test generation...',
        'Almost there...'
    ];
    
    let messageIndex = 0;
    const progressInterval = setInterval(() => {
        if (messageIndex < progressMessages.length) {
            progressCallback(progressMessages[messageIndex]);
            messageIndex++;
        }
    }, 5000);
    
    try {
        progressCallback('Generating tests...');
        
        // Make API request to generate tests
        const response = await axios.post<TestGenerationResponse>(
            'https://devexy-backend.azurewebsites.net/test-gen/generate-unit-tests',
            requestData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000  // 2 minute timeout
            }
        );
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        progressCallback('Processing results...');
        
        // Handle successful response
        return response.data.tests;
    } catch (error) {
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // Handle errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('The test generation request timed out. Try with fewer or smaller files.');
            } else if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Authentication failed. Your token may have expired. Please log in again.');
                } else {
                    throw new Error(`Test generation failed: ${error.response.data?.detail || error.message}`);
                }
            } else if (error.request) {
                throw new Error('Test generation request failed. Please check your connection and try again.');
            }
        }
        throw error;
    }
}

async function readFileContent(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
}

export async function applyGeneratedTests(tests: GeneratedTest[]): Promise<{ success: string[], errors: string[] }> {
    // Check if a workspace folder is available
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found. Please open a workspace or folder to save test files.');
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const success: string[] = [];
    const errors: string[] = [];
    
    // Create each test file
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        const filePath = path.join(workspaceRoot, test.filepath);
        const fileUri = vscode.Uri.file(filePath);
        
        // Create directory if it doesn't exist
        const dirPath = path.dirname(filePath);
        
        try {
            // Create directory recursively
            await ensureDirectoryExists(dirPath);
            
            // Check if file already exists
            try {
                await vscode.workspace.fs.stat(fileUri);
                
                // File exists, ask for confirmation to overwrite
                const overwrite = await vscode.window.showWarningMessage(
                    `File ${test.filepath} already exists. Do you want to overwrite it?`,
                    { modal: true },
                    'Overwrite',
                    'Skip'
                );
                
                if (overwrite !== 'Overwrite') {
                    continue;
                }
            } catch (e) {
                // File doesn't exist, this is fine
            }
            
            // Create file with the test content
            const encoder = new TextEncoder();
            const data = encoder.encode(test.content);
            await vscode.workspace.fs.writeFile(fileUri, data);
            
            success.push(test.filepath);
        } catch (error) {
            console.error(`Error creating file ${filePath}:`, error);
            errors.push(test.filepath);
        }
    }
    
    return { success, errors };
}

// Export the utility function so it can be used in integrationTestGeneration.ts
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.mkdir(dirPath, { recursive: true }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}