import * as vscode from 'vscode';
import axios from 'axios';
import { getAuthToken } from './auth';

// Types for API communication
interface SourceFile {
    filepath: string;
    content: string;
}

interface TestFile {
    filepath: string;
    content: string;
}

interface RiskCategory {
    name: string;
    description: string;
    severity: number;
    impact_areas: string[];
}

interface TestPriority {
    test_name: string;
    filepath: string;
    test_line: number;
    priority_score: number;
    risk_categories: RiskCategory[];
    failure_impact: string;
    security_concerns: string;
    dependencies: string[];
    coverage_impact: number;
}

interface SecurityVulnerability {
    description: string;
    severity: number;
    affected_code: string;
    mitigation_recommendations: string[];
    cwe_reference: string;
}

interface VisualizationData {
    priority_distribution: {
        high: number;
        medium: number;
        low: number;
    };
    risk_category_distribution: {
        [key: string]: number;
    };
    critical_tests_by_module: {
        [key: string]: number;
    };
    security_impact_scores: {
        test_name: string;
        score: number;
        category: string;
    }[];
}

export interface TestPriorityAnalysisRequest {
    source_files: SourceFile[];
    test_files: TestFile[];
    description?: string;
    code_criticality_context?: string;
}

export interface TestPriorityAnalysisResponse {
    summary: {
        overall_assessment: string;
        critical_areas: string[];
        high_risk_count: number;
        medium_risk_count: number;
        low_risk_count: number;
        security_vulnerability_count: number;
        top_priority_tests_count: number;
    };
    test_priorities: TestPriority[];
    security_vulnerabilities: SecurityVulnerability[];
    visualization_data: VisualizationData;
    recommendations: string[];
}

export async function analyzeTestPriority(
    context: vscode.ExtensionContext,
    sourceFiles: vscode.Uri[],
    testFiles: vscode.Uri[],
    codeCriticalityContext: string = "",
    progressCallback: (message: string) => void
): Promise<TestPriorityAnalysisResponse> {
    // Get authentication token
    const token = await getAuthToken(context);
    
    // Prepare files content
    progressCallback('Preparing files for test priority analysis...');
    
    const sourceFilesContent: SourceFile[] = await Promise.all(sourceFiles.map(async (file) => {
        const relativePath = vscode.workspace.asRelativePath(file);
        const content = await readFileContent(file);
        
        return {
            filepath: relativePath,
            content: content
        };
    }));

    const testFilesContent: TestFile[] = await Promise.all(testFiles.map(async (file) => {
        const relativePath = vscode.workspace.asRelativePath(file);
        const content = await readFileContent(file);
        
        return {
            filepath: relativePath,
            content: content
        };
    }));

    // Prepare request data
    const requestData: TestPriorityAnalysisRequest = {
        source_files: sourceFilesContent,
        test_files: testFilesContent,
        description: "Analyze test case priority and risk assessment",
        code_criticality_context: codeCriticalityContext
    };

    // Create progress updates
    const progressMessages = [
        'Analyzing source and test files...',
        'Evaluating test case priorities...',
        'Identifying security vulnerabilities...',
        'Assessing risk factors...',
        'Generating risk assessment report...',
        'Finalizing priority analysis...',
    ];
    
    let messageIndex = 0;
    const progressInterval = setInterval(() => {
        if (messageIndex < progressMessages.length) {
            progressCallback(progressMessages[messageIndex]);
            messageIndex++;
        }
    }, 2000);
    
    try {
        progressCallback('Analyzing test priorities and risks...');
        
        // Make API request to analyze test priorities
        const response = await axios.post<TestPriorityAnalysisResponse>(
            'https://devexy-backend.azurewebsites.net/test-gen/analyze-test-priority',
            requestData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000  // 1 minute timeout
            }
        );
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        progressCallback('Processing test priority analysis results...');
        
        // Handle successful response
        return response.data;
    } catch (error) {
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // Handle errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('The test priority analysis request timed out. Try with fewer or smaller files.');
            } else if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Authentication failed. Your token may have expired. Please log in again.');
                } else {
                    throw new Error(`Test priority analysis failed: ${error.response.data?.detail || error.message}`);
                }
            } else if (error.request) {
                throw new Error('Test priority analysis request failed. Please check your connection and try again.');
            }
        }
        throw error;
    }
}

async function readFileContent(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
}