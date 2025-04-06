import * as vscode from 'vscode';
import axios from 'axios';
import { getAuthToken } from '../auth';

// Types for API communication
export interface FileContent {
    filepath: string;
    content: string;
}

export interface RequirementsContent {
    content: string;
    filepath?: string;
}

export interface RequirementsAnalysisRequest {
    requirements_content: RequirementsContent;
    source_files?: FileContent[];
    description?: string;
}

export interface RequirementsOptimizationRequest {
    requirements_content: RequirementsContent;
    source_files?: FileContent[];
    optimization_goals: string[];
    keep_dependencies?: string[];
    description?: string;
}

export interface RequirementDependency {
    name: string;
    version: string;
    size_kb: number;
    memory_usage_estimate_mb: number;
    startup_time_impact_ms: number;
    is_direct: boolean;
    imported_by: string[];
    alternatives: string[];
    usage_in_code?: string[];
}

export interface RequirementsAnalysisResponse {
    summary: {
        total_dependencies: number;
        direct_dependencies: number;
        transitive_dependencies: number;
        estimated_size_kb: number;
        estimated_baseline_memory_mb: number;
        estimated_startup_time_sec: number;
        high_impact_packages: string[];
        security_concerns_count: number;
        optimization_opportunities_count: number;
        unused_dependencies_count: number;
    };
    dependencies: RequirementDependency[];
    performance_impact: {
        slow_startup_packages: { name: string; startup_time_ms: number; mitigation: string }[];
        heavy_import_time_packages: { name: string; import_time_ms: number; mitigation: string }[];
        known_bottlenecks: { name: string; issue: string; mitigation: string }[];
        estimated_total_startup_time_ms: number;
        lazy_loading_candidates: string[];
    };
    memory_impact: {
        memory_intensive_libs: { name: string; baseline_mb: number; peak_mb: number; mitigation: string }[];
        estimated_baseline_memory_mb: number;
        packages_with_memory_issues: { name: string; issue: string; mitigation: string }[];
        estimated_peak_memory_mb: number;
        optimization_strategies: string[];
    };
    security_concerns: {
        package: string;
        severity: string;
        vulnerability: string;
        recommendation: string;
    }[];
    optimization_opportunities: {
        type: string;
        package: string;
        reason: string;
        estimated_impact: string;
        alternative?: string;
    }[];
    visualization_data: {
        size_distribution: { name: string; size_kb: number }[];
        memory_usage: { name: string; memory_mb: number }[];
        startup_time: { name: string; time_ms: number }[];
        dependency_graph: {
            nodes: { id: string; group: number }[];
            links: { source: string; target: string }[];
        };
    };
    code_specific_insights?: {
        unused_dependencies: { name: string; reason: string }[];
        suboptimal_imports: { file: string; line: number; current: string; suggestion: string }[];
        dependency_usage_frequency: { name: string; import_count: number; usage_count: number }[];
    };
}

export interface OptimizedRequirement {
    name: string;
    original_version?: string;
    optimized_version: string;
    reason: string;
    impact: {
        performance: string;
        memory: string;
        security?: string;
    };
    code_references?: string[];
}

export interface RequirementsOptimizationResponse {
    optimized_content: string;
    summary: {
        total_changes: number;
        removed_packages: number;
        updated_versions: number;
        replaced_packages: number;
        estimated_performance_improvement: string;
        estimated_memory_reduction: string;
        security_vulnerabilities_addressed: number;
        unused_dependencies_removed: number;
    };
    changes: OptimizedRequirement[];
    performance_improvement: {
        startup_time_reduction_ms: number;
        import_time_improvement: string;
        key_improvements: string[];
    };
    memory_improvement: {
        baseline_reduction_mb: number;
        peak_reduction_mb: number;
        key_improvements: string[];
    };
    security_improvement?: {
        vulnerabilities_fixed: number;
        key_fixes: string[];
    };
    recommendations: string[];
    unused_dependencies?: string[];
}

export async function analyzeRequirements(
    context: vscode.ExtensionContext,
    requirementsContent: RequirementsContent,
    sourceFiles: vscode.Uri[] = [],
    description: string = 'Analyze requirements file for performance and memory usage',
    progressCallback: (message: string) => void
): Promise<RequirementsAnalysisResponse> {
    // Get authentication token
    const token = await getAuthToken(context);
    
    // Prepare source files content
    progressCallback('Preparing files for requirements analysis...');
    
    const sourceFilesContent: FileContent[] = await Promise.all(sourceFiles.map(async (file) => {
        const relativePath = vscode.workspace.asRelativePath(file);
        const content = await readFileContent(file);
        
        return {
            filepath: relativePath,
            content: content
        };
    }));

    // Prepare request data
    const requestData: RequirementsAnalysisRequest = {
        requirements_content: requirementsContent,
        source_files: sourceFilesContent.length > 0 ? sourceFilesContent : undefined,
        description: description
    };

    // Create progress updates
    const progressMessages = [
        'Analyzing requirements file...',
        'Evaluating dependencies...',
        'Calculating memory impact...',
        'Assessing performance impact...',
        'Checking for security issues...',
        'Generating visualization data...',
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
        progressCallback('Analyzing requirements...');
        
        // Make API request to analyze requirements
        const response = await axios.post<RequirementsAnalysisResponse>(
            'https://devexy-backend.azurewebsites.net/requirements/analyze',
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
        
        progressCallback('Processing requirements analysis results...');
        
        // Handle successful response
        return response.data;
    } catch (error) {
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // Handle errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('The requirements analysis request timed out. Try with fewer or smaller files.');
            } else if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Authentication failed. Your token may have expired. Please log in again.');
                } else {
                    throw new Error(`Requirements analysis failed: ${error.response.data?.detail || error.message}`);
                }
            } else if (error.request) {
                throw new Error('Requirements analysis request failed. Please check your connection and try again.');
            }
        }
        throw error;
    }
}

export async function optimizeRequirements(
    context: vscode.ExtensionContext,
    requirementsContent: RequirementsContent,
    optimizationGoals: string[] = ['memory', 'performance', 'security'],
    keepDependencies: string[] = [],
    sourceFiles: vscode.Uri[] = [],
    description: string = 'Optimize requirements file for better performance and lower memory usage',
    progressCallback: (message: string) => void
): Promise<RequirementsOptimizationResponse> {
    // Get authentication token
    const token = await getAuthToken(context);
    
    // Prepare source files content
    progressCallback('Preparing files for requirements optimization...');
    
    const sourceFilesContent: FileContent[] = await Promise.all(sourceFiles.map(async (file) => {
        const relativePath = vscode.workspace.asRelativePath(file);
        const content = await readFileContent(file);
        
        return {
            filepath: relativePath,
            content: content
        };
    }));

    // Prepare request data
    const requestData: RequirementsOptimizationRequest = {
        requirements_content: requirementsContent,
        source_files: sourceFilesContent.length > 0 ? sourceFilesContent : undefined,
        optimization_goals: optimizationGoals,
        keep_dependencies: keepDependencies.length > 0 ? keepDependencies : undefined,
        description: description
    };

    // Create progress updates
    const progressMessages = [
        'Analyzing requirements file...',
        'Evaluating optimization opportunities...',
        'Finding alternative packages...',
        'Checking for unused dependencies...',
        'Optimizing package versions...',
        'Generating optimized requirements file...',
        'Finalizing optimization...',
    ];
    
    let messageIndex = 0;
    const progressInterval = setInterval(() => {
        if (messageIndex < progressMessages.length) {
            progressCallback(progressMessages[messageIndex]);
            messageIndex++;
        }
    }, 2000);
    
    try {
        progressCallback('Optimizing requirements...');
        
        // Make API request to optimize requirements
        const response = await axios.post<RequirementsOptimizationResponse>(
            'https://devexy-backend.azurewebsites.net/requirements/optimize',
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
        
        progressCallback('Processing requirements optimization results...');
        
        // Handle successful response
        return response.data;
    } catch (error) {
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // Handle errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('The requirements optimization request timed out. Try with fewer or smaller files.');
            } else if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Authentication failed. Your token may have expired. Please log in again.');
                } else {
                    throw new Error(`Requirements optimization failed: ${error.response.data?.detail || error.message}`);
                }
            } else if (error.request) {
                throw new Error('Requirements optimization request failed. Please check your connection and try again.');
            }
        }
        throw error;
    }
}

async function readFileContent(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
}