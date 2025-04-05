import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { getAuthToken } from './auth';
import { GeneratedTest } from './testGeneration'; // Reuse types from testGeneration

// Types for API communication
interface FileContent {
    filepath: string;
    content: string;
}

interface StressTestGenerationRequest {
    files: FileContent[];
    description?: string;
    test_directory?: string;
}

interface StressTestGenerationResponse {
    tests: GeneratedTest[];
    message: string;
}

export async function generateStressTests(
    context: vscode.ExtensionContext,
    files: vscode.Uri[],
    testDirectory: string,
    progressCallback: (message: string) => void
): Promise<GeneratedTest[]> {
    // Get authentication token
    const token = await getAuthToken(context);
    
    // Prepare files content
    progressCallback('Preparing files for stress test generation...');
    
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
    const requestData: StressTestGenerationRequest = {
        files: fileContents,
        description: "Generate stress tests to validate the system's performance under high load, including load testing, scalability testing, and identifying bottlenecks under various concurrency levels.",
        test_directory: testDirectory
    };

    // Create progress updates
    const progressMessages = [
        'Analyzing code for performance bottlenecks...',
        'Identifying critical endpoints for stress testing...',
        'Designing load test scenarios...',
        'Creating concurrency test patterns...',
        'Generating stress test code...',
        'Still working on tests...',
        'This is taking longer than expected, but still working...',
        'Finalizing stress test generation...',
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
        progressCallback('Generating stress tests...');
        
        // Make API request to generate stress tests
        const response = await axios.post<StressTestGenerationResponse>(
            'https://devexy-backend.azurewebsites.net/test-gen/generate-stress-tests',
            requestData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 240000  // 4 minute timeout (stress tests might take longer)
            }
        );
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        progressCallback('Processing stress test results...');
        
        // Handle successful response
        return response.data.tests;
    } catch (error) {
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // Handle errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('The stress test generation request timed out. Try with fewer or smaller files.');
            } else if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Authentication failed. Your token may have expired. Please log in again.');
                } else {
                    throw new Error(`Stress test generation failed: ${error.response.data?.detail || error.message}`);
                }
            } else if (error.request) {
                throw new Error('Stress test generation request failed. Please check your connection and try again.');
            }
        }
        throw error;
    }
}

async function readFileContent(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
}