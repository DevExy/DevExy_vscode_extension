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

interface CoverageAnalysisRequest {
    source_files: SourceFile[];
    test_files: TestFile[];
}

interface CoverageMetric {
    value: number;
    explanation: string;
    uncovered_areas: string | null;
}

interface TestImprovementSuggestion {
    description: string;
    implementation_hint: string;
}

interface CoverageOverall {
    statement_coverage: CoverageMetric;
    branch_coverage: CoverageMetric;
    function_coverage: CoverageMetric;
    condition_coverage: CoverageMetric;
}

interface FileMetrics {
    statement_coverage: CoverageMetric;
    branch_coverage: CoverageMetric;
    function_coverage: CoverageMetric;
    condition_coverage: CoverageMetric;
}

interface FileAnalysis {
    filepath: string;
    metrics: FileMetrics;
    uncovered_lines: number[];
    uncovered_branches: string[];
    uncovered_functions: string[];
    missed_edge_cases: string[];
    test_improvement_suggestions: TestImprovementSuggestion[];
    risk_assessment: string;
}

interface SummaryChartData {
    filename: string;
    statement_coverage: number;
    branch_coverage: number;
    function_coverage: number;
    condition_coverage: number;
}

interface HotspotData {
    line: number;
    coverage_score: number;
    description: string;
}

interface HeatmapData {
    filepath: string;
    hotspots: HotspotData[];
}

interface MissedTestCaseCategories {
    [key: string]: number;
}

interface MissedTestCasesChart {
    filename: string;
    count: number;
    categories: MissedTestCaseCategories;
}

interface ImprovementPotentialChart {
    filename: string;
    current_overall_coverage: number;
    potential_coverage: number;
    improvement_percentage: number;
}

interface VisualizationData {
    summary_chart_data: SummaryChartData[];
    heatmap_data: HeatmapData[];
    missed_test_cases_chart: MissedTestCasesChart[];
    improvement_potential_chart: ImprovementPotentialChart[];
}

export interface CoverageAnalysisResponse {
    summary: {
        overall_coverage: CoverageOverall;
        recommendations: string[];
    };
    files_analysis: FileAnalysis[];
    visualization_data: VisualizationData;
}

export async function analyzeCoverage(
    context: vscode.ExtensionContext,
    sourceFiles: vscode.Uri[],
    testFiles: vscode.Uri[],
    progressCallback: (message: string) => void
): Promise<CoverageAnalysisResponse> {
    // Get authentication token
    const token = await getAuthToken(context);
    
    // Prepare files content
    progressCallback('Preparing files for coverage analysis...');
    
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
    const requestData: CoverageAnalysisRequest = {
        source_files: sourceFilesContent,
        test_files: testFilesContent
    };

    // Create progress updates
    const progressMessages = [
        'Analyzing source and test files...',
        'Calculating coverage metrics...',
        'Identifying uncovered areas...',
        'Generating coverage report...',
        'Creating visualization data...',
        'Finalizing analysis results...',
    ];
    
    let messageIndex = 0;
    const progressInterval = setInterval(() => {
        if (messageIndex < progressMessages.length) {
            progressCallback(progressMessages[messageIndex]);
            messageIndex++;
        }
    }, 2000);
    
    try {
        progressCallback('Analyzing code coverage...');
        
        // Make API request to analyze coverage
        const response = await axios.post<CoverageAnalysisResponse>(
            'https://devexy-backend.azurewebsites.net/test-gen/analyze-coverage',
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
        
        progressCallback('Processing coverage analysis results...');
        
        // Handle successful response
        return response.data;
    } catch (error) {
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // Handle errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('The coverage analysis request timed out. Try with fewer or smaller files.');
            } else if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Authentication failed. Your token may have expired. Please log in again.');
                } else {
                    throw new Error(`Coverage analysis failed: ${error.response.data?.detail || error.message}`);
                }
            } else if (error.request) {
                throw new Error('Coverage analysis request failed. Please check your connection and try again.');
            }
        }
        throw error;
    }
}

async function readFileContent(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
}