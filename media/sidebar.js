(function() {
    // Get VSCode API
    const vscode = acquireVsCodeApi();
    
    // Store current login state
    let isCurrentlyLoggedIn = false;

    // Add these variables for the coverage analysis UI
    const coverageAnalysisSection = document.getElementById('coverage-analysis-section');
    const coverageResultsSection = document.getElementById('coverage-results-section');
    const selectSourceFilesButton = document.getElementById('select-source-files-button');
    const selectTestFilesButton = document.getElementById('select-test-files-button');
    const analyzeCoverageButton = document.getElementById('analyze-coverage-button');
    const closeCoverageButton = document.getElementById('close-coverage-button');
    const sourceFilesList = document.getElementById('source-files-list');
    const testFilesList = document.getElementById('test-files-list');
    const coverageStatusMessage = document.getElementById('coverage-status-message');
    const coverageSummary = document.getElementById('coverage-summary');
    const coverageRecommendations = document.getElementById('coverage-recommendations');
    const coverageVisualization = document.getElementById('coverage-visualization');
    const filesAnalysis = document.getElementById('files-analysis');

    // Login elements
    const loginSection = document.getElementById('login-section');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const loginStatusMessage = document.getElementById('login-status-message');
    const loginStatus = document.getElementById('login-status');
    
    // Generate tests elements
    const generateTestsSection = document.getElementById('generate-tests-section');
    const testDirectoryInput = document.getElementById('test-directory');
    const generateUnitButton = document.getElementById('generate-unit-button');
    const generateIntegrationButton = document.getElementById('generate-integration-button');
    const generateStressButton = document.getElementById('generate-stress-button');
    const testStatusMessage = document.getElementById('test-status-message');

    // Test results elements
    const testResultsSection = document.getElementById('test-results-section');
    const testResultsList = document.getElementById('test-results-list');
    const applyButton = document.getElementById('apply-button');
    const cancelButton = document.getElementById('cancel-button');

    // Add event listeners for UI interactions
    loginButton.addEventListener('click', () => {
        login();
    });
    
    generateUnitButton.addEventListener('click', () => {
        checkLoginAndExecute(() => generateTests('unit'));
    });

    generateIntegrationButton.addEventListener('click', () => {
        checkLoginAndExecute(() => generateTests('integration'));
    });

    generateStressButton.addEventListener('click', () => {
        checkLoginAndExecute(() => generateTests('stress'));
    });

    applyButton.addEventListener('click', () => {
        checkLoginAndExecute(() => applyTests());
    });

    cancelButton.addEventListener('click', () => {
        cancelTestResults();
    });

    // Add event listeners for coverage analysis
    selectSourceFilesButton.addEventListener('click', () => {
        checkLoginAndExecute(() => vscode.postMessage({ command: 'selectSourceFiles' }));
    });

    selectTestFilesButton.addEventListener('click', () => {
        checkLoginAndExecute(() => vscode.postMessage({ command: 'selectTestFiles' }));
    });

    analyzeCoverageButton.addEventListener('click', () => {
        checkLoginAndExecute(() => vscode.postMessage({ command: 'analyzeCoverage' }));
    });

    closeCoverageButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'closeCoverageResults' });
    });

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        handleMessage(message);
    });

    // Handle login inputs
    usernameInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            login();
        }
    });

    // Check login state on load
    checkLoginStatus();

    // Utility function to ensure user is logged in before executing actions
    function checkLoginAndExecute(action) {
        if (!isCurrentlyLoggedIn) {
            vscode.postMessage({
                command: 'logOutput',
                text: 'User attempted to use feature without logging in'
            });
            updateTestStatus('error', 'Please log in first to use this feature');
            // Show the login section and hide other sections
            loginSection.classList.remove('hidden');
            generateTestsSection.classList.add('hidden');
            coverageAnalysisSection.classList.add('hidden');
            testResultsSection.classList.add('hidden');
            return;
        }
        
        action();
    }
    
    // Functions to handle UI interactions
    function login() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            updateLoginStatus('error', 'Please enter both username and password');
            return;
        }
        
        updateLoginStatus('loading', 'Logging in...');
        
        vscode.postMessage({
            command: 'login',
            username: username,
            password: password
        });
        
        // Reset password field for security
        passwordInput.value = '';
    }

    function generateTests(type) {
        const testDirectory = testDirectoryInput.value.trim() || 'tests';
        
        updateTestStatus('loading', `Generating ${type} tests...`);
        
        vscode.postMessage({
            command: 'generateTests',
            type: type,
            testDirectory: testDirectory
        });
    }

    function applyTests() {
        vscode.postMessage({
            command: 'applyTestResults'
        });
    }

    function cancelTestResults() {
        testResultsSection.classList.add('hidden');
        generateTestsSection.classList.remove('hidden');
    }

    function checkLoginStatus() {
        vscode.postMessage({
            command: 'checkLoginStatus'
        });
    }

    // Download report as PDF
    function downloadReportAsPDF() {
        vscode.postMessage({
            command: 'downloadCoverageReport'
        });
    }

    // Handle messages from the extension
    function handleMessage(message) {
        switch (message.command) {
            case 'loginStatus':
                updateAuthStatus(message.isLoggedIn, message.username);
                isCurrentlyLoggedIn = message.isLoggedIn;
                
                // Make sure we show the login form and hide other sections when logged out
                if (!message.isLoggedIn) {
                    loginSection.classList.remove('hidden');
                    generateTestsSection.classList.add('hidden');
                    coverageAnalysisSection.classList.add('hidden');
                    testResultsSection.classList.add('hidden');
                    coverageResultsSection.classList.add('hidden');
                } else {
                    loginSection.classList.add('hidden');
                    generateTestsSection.classList.remove('hidden');
                    coverageAnalysisSection.classList.remove('hidden');
                }
                break;
            
            case 'updateStatus':
                if (message.action === 'login') {
                    updateLoginStatus(message.status, message.message);
                    
                    // If login was successful, update UI accordingly
                    if (message.status === 'success') {
                        isCurrentlyLoggedIn = true;
                        loginSection.classList.add('hidden');
                        generateTestsSection.classList.remove('hidden');
                        coverageAnalysisSection.classList.remove('hidden');
                    }
                } else if (message.action === 'generateTests') {
                    updateTestStatus(message.status, message.message);
                } else if (message.action === 'coverage') {
                    updateCoverageStatus(message.status, message.message);
                }
                break;
            
            case 'updateLoginStatus':
                updateLoginStatus(message.status, message.message);
                if (message.status === 'success') {
                    isCurrentlyLoggedIn = true;
                }
                break;
            
            case 'updateAuthStatus':
                updateAuthStatus(message.isLoggedIn, message.username);
                isCurrentlyLoggedIn = message.isLoggedIn;
                break;

            case 'updateTestStatus':
                updateTestStatus(message.status, message.message);
                break;
            
            case 'updateTestResults':
                updateTestResults(message.tests);
                break;
                
            case 'updateSourceFiles':
                updateFilesList(sourceFilesList, message.files);
                break;

            case 'updateTestFiles':
                updateFilesList(testFilesList, message.files);
                break;

            case 'updateCoverageResults':
                displayCoverageResults(message.results);
                break;

            case 'hideCoverageResults':
                coverageResultsSection.classList.add('hidden');
                coverageAnalysisSection.classList.remove('hidden');
                break;
                
            case 'updateProgress':
                if (message.action === 'coverage') {
                    updateCoverageStatus('loading', message.message);
                }
                break;
                
            case 'showError':
                if (message.action === 'coverage') {
                    updateCoverageStatus('error', message.message);
                }
                break;
                
            case 'reportDownloaded':
                updateCoverageStatus('success', 'Report downloaded successfully');
                break;
                
            case 'reportDownloadError':
                updateCoverageStatus('error', 'Failed to download report: ' + message.error);
                break;
        }
    }

    // UI update functions
    function updateLoginStatus(status, message) {
        loginStatusMessage.innerHTML = message;
        
        if (status === 'success') {
            loginStatusMessage.className = 'status-message success';
            // Clear the form
            usernameInput.value = '';
            passwordInput.value = '';
        } else if (status === 'error') {
            loginStatusMessage.className = 'status-message error';
        } else if (status === 'loading') {
            loginStatusMessage.className = 'status-message loading';
        } else {
            loginStatusMessage.className = 'status-message';
        }
    }

    function updateAuthStatus(isLoggedIn, username) {
        const statusIndicator = loginStatus.querySelector('.status-indicator');
        const statusText = loginStatus.querySelector('.status-text');
        
        if (isLoggedIn) {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = `Logged in as ${username || 'user'}`;
            loginSection.classList.add('hidden');
            generateTestsSection.classList.remove('hidden');
            coverageAnalysisSection.classList.remove('hidden');
            isCurrentlyLoggedIn = true;
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'Not logged in';
            loginSection.classList.remove('hidden');
            generateTestsSection.classList.add('hidden');
            coverageAnalysisSection.classList.add('hidden');
            testResultsSection.classList.add('hidden');
            coverageResultsSection.classList.add('hidden');
            isCurrentlyLoggedIn = false;
        }
    }

    function updateTestStatus(status, message) {
        testStatusMessage.innerHTML = message;
        
        if (status === 'success') {
            testStatusMessage.className = 'status-message success';
        } else if (status === 'error') {
            testStatusMessage.className = 'status-message error';
        } else if (status === 'loading') {
            testStatusMessage.className = 'status-message loading';
        } else {
            testStatusMessage.className = 'status-message';
        }
    }

    function updateTestResults(tests) {
        // Clear previous test results
        testResultsList.innerHTML = '';
        
        // Add each test result
        tests.forEach(test => {
            const testItem = document.createElement('div');
            testItem.className = 'test-item';
            
            const testHeader = document.createElement('div');
            testHeader.className = 'test-header';
            
            const testTitle = document.createElement('div');
            testTitle.className = 'test-title';
            testTitle.textContent = test.filepath;
            
            const testActions = document.createElement('div');
            testActions.className = 'test-actions';
            
            const previewButton = document.createElement('button');
            previewButton.className = 'action-button';
            previewButton.textContent = 'Preview';
            previewButton.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'previewTest',
                    test: test
                });
            });
            
            testActions.appendChild(previewButton);
            testHeader.appendChild(testTitle);
            testHeader.appendChild(testActions);
            testItem.appendChild(testHeader);
            
            testResultsList.appendChild(testItem);
        });
        
        // Show test results section
        testResultsSection.classList.remove('hidden');
        generateTestsSection.classList.add('hidden');
    }

    function updateCoverageStatus(status, message) {
        coverageStatusMessage.innerHTML = message;
        
        if (status === 'success') {
            coverageStatusMessage.className = 'status-message success';
        } else if (status === 'error') {
            coverageStatusMessage.className = 'status-message error';
        } else if (status === 'loading') {
            coverageStatusMessage.className = 'status-message loading';
        } else {
            coverageStatusMessage.className = 'status-message';
        }
    }
    
    // Coverage analysis functions
    function updateFilesList(listElement, files) {
        // Clear any existing content
        listElement.innerHTML = '';
        
        if (files && files.length > 0) {
            // Create file items
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.textContent = file;
                listElement.appendChild(fileItem);
            });
        } else {
            // Show "no files" message
            const noFiles = document.createElement('p');
            noFiles.className = 'info-text';
            noFiles.textContent = 'No files selected';
            listElement.appendChild(noFiles);
        }
    }

    function displayCoverageResults(results) {
        // Hide analysis section, show results section
        coverageAnalysisSection.classList.add('hidden');
        coverageResultsSection.classList.remove('hidden');
        
        // Display summary
        displayCoverageSummary(results.summary);
        
        // Display recommendations
        displayRecommendations(results.summary.recommendations);
        
        // Display visualizations
        displayVisualizations(results.visualization_data);
        
        // Display file analysis
        displayFilesAnalysis(results.files_analysis);
        
        // Add download report button
        addDownloadReportButton();
        
        // Clear status message
        coverageStatusMessage.className = 'status-message';
        coverageStatusMessage.innerHTML = '';
    }

    function displayCoverageSummary(summary) {
        // Clear existing content
        coverageSummary.innerHTML = '';
        
        // Create summary heading
        const summaryHeading = document.createElement('h3');
        summaryHeading.textContent = 'Overall Coverage';
        coverageSummary.appendChild(summaryHeading);
        
        // Get metrics
        const metrics = summary.overall_coverage;
        
        // Create metric elements
        createCoverageMetric('Statement Coverage', metrics.statement_coverage, coverageSummary);
        createCoverageMetric('Branch Coverage', metrics.branch_coverage, coverageSummary);
        createCoverageMetric('Function Coverage', metrics.function_coverage, coverageSummary);
        createCoverageMetric('Condition Coverage', metrics.condition_coverage, coverageSummary);
    }

    function createCoverageMetric(name, metric, container) {
        const metricDiv = document.createElement('div');
        metricDiv.className = 'coverage-metric';
        
        const metricName = document.createElement('div');
        metricName.className = 'coverage-metric-name';
        metricName.textContent = name;
        metricDiv.appendChild(metricName);
        
        const metricValueDiv = document.createElement('div');
        metricValueDiv.className = 'coverage-metric-value';
        
        const percentText = document.createElement('div');
        percentText.className = 'coverage-value';
        percentText.textContent = `${metric.value}%`;
        metricValueDiv.appendChild(percentText);
        
        const barContainer = document.createElement('div');
        barContainer.className = 'coverage-bar-container';
        
        const bar = document.createElement('div');
        bar.className = 'coverage-bar';
        bar.style.width = `${metric.value}%`;
        barContainer.appendChild(bar);
        
        metricValueDiv.appendChild(barContainer);
        metricDiv.appendChild(metricValueDiv);
        
        if (metric.explanation) {
            const explanation = document.createElement('div');
            explanation.className = 'coverage-metric-explanation';
            explanation.textContent = metric.explanation;
            metricDiv.appendChild(explanation);
        }
        
        container.appendChild(metricDiv);
    }

    function displayRecommendations(recommendations) {
        // Clear existing content
        coverageRecommendations.innerHTML = '';
        
        if (!recommendations || recommendations.length === 0) {
            return;
        }
        
        // Create recommendations heading
        const heading = document.createElement('h3');
        heading.textContent = 'Recommendations';
        coverageRecommendations.appendChild(heading);
        
        // Create list
        const list = document.createElement('ul');
        list.className = 'recommendations-list';
        
        recommendations.forEach(recommendation => {
            const item = document.createElement('li');
            item.textContent = recommendation;
            list.appendChild(item);
        });
        
        coverageRecommendations.appendChild(list);
    }

    function displayVisualizations(visualizationData) {
        // Clear existing content
        coverageVisualization.innerHTML = '';
        
        if (!visualizationData) {
            return;
        }
        
        // Create heading
        const heading = document.createElement('h3');
        heading.textContent = 'Coverage Visualizations';
        coverageVisualization.appendChild(heading);
        
        // Display summary chart if available
        if (visualizationData.summary_chart_data && visualizationData.summary_chart_data.length > 0) {
            displaySummaryChart(visualizationData.summary_chart_data);
        }
        
        // Display improvement potential chart if available
        if (visualizationData.improvement_potential_chart && visualizationData.improvement_potential_chart.length > 0) {
            displayImprovementPotentialChart(visualizationData.improvement_potential_chart);
        }
        
        // Display missed test cases chart if available
        if (visualizationData.missed_test_cases_chart && visualizationData.missed_test_cases_chart.length > 0) {
            displayMissedTestCasesChart(visualizationData.missed_test_cases_chart);
        }
        
        // Display heatmap data if available
        if (visualizationData.heatmap_data && visualizationData.heatmap_data.length > 0) {
            displayHeatmapData(visualizationData.heatmap_data);
        }
    }
    
    function displaySummaryChart(summaryChartData) {
        const chartSection = document.createElement('div');
        chartSection.className = 'visualization-section';
        
        const chartTitle = document.createElement('h4');
        chartTitle.textContent = 'Coverage by File';
        chartSection.appendChild(chartTitle);
        
        // Create chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        
        // Create a table to display the chart data
        const table = document.createElement('table');
        table.className = 'coverage-chart-table';
        
        // Create header row
        const headerRow = document.createElement('tr');
        const headers = ['File', 'Statement', 'Branch', 'Function', 'Condition'];
        
        headers.forEach(headerText => {
            const header = document.createElement('th');
            header.textContent = headerText;
            headerRow.appendChild(header);
        });
        
        table.appendChild(headerRow);
        
        // Create data rows
        summaryChartData.forEach(fileData => {
            const row = document.createElement('tr');
            
            const fileCell = document.createElement('td');
            fileCell.textContent = fileData.filename;
            row.appendChild(fileCell);
            
            const statementCell = document.createElement('td');
            statementCell.textContent = `${fileData.statement_coverage}%`;
            statementCell.style.color = getCoverageColor(fileData.statement_coverage);
            row.appendChild(statementCell);
            
            const branchCell = document.createElement('td');
            branchCell.textContent = `${fileData.branch_coverage}%`;
            branchCell.style.color = getCoverageColor(fileData.branch_coverage);
            row.appendChild(branchCell);
            
            const functionCell = document.createElement('td');
            functionCell.textContent = `${fileData.function_coverage}%`;
            functionCell.style.color = getCoverageColor(fileData.function_coverage);
            row.appendChild(functionCell);
            
            const conditionCell = document.createElement('td');
            conditionCell.textContent = `${fileData.condition_coverage}%`;
            conditionCell.style.color = getCoverageColor(fileData.condition_coverage);
            row.appendChild(conditionCell);
            
            table.appendChild(row);
        });
        
        chartContainer.appendChild(table);
        chartSection.appendChild(chartContainer);
        coverageVisualization.appendChild(chartSection);
    }
    
    function displayImprovementPotentialChart(improvementData) {
        const chartSection = document.createElement('div');
        chartSection.className = 'visualization-section';
        
        const chartTitle = document.createElement('h4');
        chartTitle.textContent = 'Improvement Potential';
        chartSection.appendChild(chartTitle);
        
        // Create chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        
        // Create improvement chart as a table
        const table = document.createElement('table');
        table.className = 'coverage-chart-table';
        
        // Create header row
        const headerRow = document.createElement('tr');
        const headers = ['File', 'Current Coverage', 'Potential Coverage', 'Improvement'];
        
        headers.forEach(headerText => {
            const header = document.createElement('th');
            header.textContent = headerText;
            headerRow.appendChild(header);
        });
        
        table.appendChild(headerRow);
        
        // Create data rows
        improvementData.forEach(fileData => {
            const row = document.createElement('tr');
            
            const fileCell = document.createElement('td');
            fileCell.textContent = fileData.filename;
            row.appendChild(fileCell);
            
            const currentCell = document.createElement('td');
            currentCell.textContent = `${fileData.current_overall_coverage}%`;
            currentCell.style.color = getCoverageColor(fileData.current_overall_coverage);
            row.appendChild(currentCell);
            
            const potentialCell = document.createElement('td');
            potentialCell.textContent = `${fileData.potential_coverage}%`;
            potentialCell.style.color = getCoverageColor(fileData.potential_coverage);
            row.appendChild(potentialCell);
            
            const improvementCell = document.createElement('td');
            improvementCell.textContent = `+${fileData.improvement_percentage}%`;
            improvementCell.style.color = '#66BB6A'; // Green color for improvements
            row.appendChild(improvementCell);
            
            table.appendChild(row);
        });
        
        chartContainer.appendChild(table);
        chartSection.appendChild(chartContainer);
        coverageVisualization.appendChild(chartSection);
    }
    
    function displayMissedTestCasesChart(missedCasesData) {
        const chartSection = document.createElement('div');
        chartSection.className = 'visualization-section';
        
        const chartTitle = document.createElement('h4');
        chartTitle.textContent = 'Missed Test Cases';
        chartSection.appendChild(chartTitle);
        
        // Create chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        
        // Create missed test cases chart as a table
        const table = document.createElement('table');
        table.className = 'coverage-chart-table';
        
        // Create header row
        const headerRow = document.createElement('tr');
        const headers = ['File', 'Missed Cases Count', 'Categories'];
        
        headers.forEach(headerText => {
            const header = document.createElement('th');
            header.textContent = headerText;
            headerRow.appendChild(header);
        });
        
        table.appendChild(headerRow);
        
        // Create data rows
        missedCasesData.forEach(fileData => {
            const row = document.createElement('tr');
            
            const fileCell = document.createElement('td');
            fileCell.textContent = fileData.filename;
            row.appendChild(fileCell);
            
            const countCell = document.createElement('td');
            countCell.textContent = fileData.count;
            row.appendChild(countCell);
            
            const categoriesCell = document.createElement('td');
            const categoriesList = document.createElement('ul');
            categoriesList.className = 'missed-cases-categories';
            
            // Convert categories object to list items
            Object.entries(fileData.categories).forEach(([category, count]) => {
                const item = document.createElement('li');
                item.textContent = `${category}: ${count}`;
                categoriesList.appendChild(item);
            });
            
            categoriesCell.appendChild(categoriesList);
            row.appendChild(categoriesCell);
            
            table.appendChild(row);
        });
        
        chartContainer.appendChild(table);
        chartSection.appendChild(chartContainer);
        coverageVisualization.appendChild(chartSection);
    }
    
    function displayHeatmapData(heatmapData) {
        const chartSection = document.createElement('div');
        chartSection.className = 'visualization-section';
        
        const chartTitle = document.createElement('h4');
        chartTitle.textContent = 'Coverage Hotspots';
        chartSection.appendChild(chartTitle);
        
        // Create hotspots container
        const hotspotsContainer = document.createElement('div');
        hotspotsContainer.className = 'hotspots-container';
        
        // Create heatmap display for each file
        heatmapData.forEach(fileData => {
            const fileSection = document.createElement('div');
            fileSection.className = 'file-hotspots';
            
            const fileName = document.createElement('h5');
            fileName.textContent = fileData.filepath;
            fileSection.appendChild(fileName);
            
            if (fileData.hotspots && fileData.hotspots.length > 0) {
                const hotspotsList = document.createElement('ul');
                hotspotsList.className = 'hotspots-list';
                
                fileData.hotspots.forEach(hotspot => {
                    const item = document.createElement('li');
                    const hotspotScore = document.createElement('span');
                    hotspotScore.className = 'hotspot-score';
                    hotspotScore.textContent = hotspot.coverage_score;
                    hotspotScore.style.backgroundColor = getCoverageColor(hotspot.coverage_score);
                    
                    item.appendChild(hotspotScore);
                    item.appendChild(document.createTextNode(` Line ${hotspot.line}: ${hotspot.description}`));
                    hotspotsList.appendChild(item);
                });
                
                fileSection.appendChild(hotspotsList);
            } else {
                const noHotspots = document.createElement('p');
                noHotspots.textContent = 'No hotspots found';
                fileSection.appendChild(noHotspots);
            }
            
            hotspotsContainer.appendChild(fileSection);
        });
        
        chartSection.appendChild(hotspotsContainer);
        coverageVisualization.appendChild(chartSection);
    }
    
    // Helper function to get color based on coverage percentage
    function getCoverageColor(percentage) {
        if (percentage >= 80) {
            return '#28a745'; // Green for good coverage
        } else if (percentage >= 50) {
            return '#ffc107'; // Yellow for moderate coverage
        } else {
            return '#dc3545'; // Red for poor coverage
        }
    }
    
    function addDownloadReportButton() {
        // Check if button already exists
        let downloadButton = document.getElementById('download-report-button');
        if (downloadButton) {
            return; // Button already exists
        }
        
        // Create download button
        downloadButton = document.createElement('button');
        downloadButton.id = 'download-report-button';
        downloadButton.className = 'primary-button download-button';
        downloadButton.textContent = 'Download PDF Report';
        downloadButton.addEventListener('click', downloadReportAsPDF);
        
        // Add button to the button group
        const buttonGroup = coverageResultsSection.querySelector('.button-group');
        buttonGroup.insertBefore(downloadButton, buttonGroup.firstChild);
    }

    function displayFilesAnalysis(filesAnalysis) {
        // Clear existing content
        filesAnalysis.innerHTML = '';
        
        if (!filesAnalysis || filesAnalysis.length === 0) {
            return;
        }
        
        // Create heading
        const heading = document.createElement('h3');
        heading.textContent = 'Files Analysis';
        filesAnalysis.appendChild(heading);
        
        // Create file analysis elements
        filesAnalysis.forEach(fileAnalysis => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-analysis';
            
            // Create header
            const header = document.createElement('div');
            header.className = 'file-analysis-header';
            
            const filename = document.createElement('div');
            filename.className = 'file-analysis-name';
            filename.textContent = fileAnalysis.filepath;
            header.appendChild(filename);
            
            const toggleButton = document.createElement('button');
            toggleButton.className = 'file-analysis-toggle';
            toggleButton.textContent = 'Show Details';
            header.appendChild(toggleButton);
            
            fileDiv.appendChild(header);
            
            // Create content (initially hidden)
            const content = document.createElement('div');
            content.className = 'file-analysis-content hidden';
            
            // Add metrics
            const metricsSection = document.createElement('div');
            metricsSection.className = 'file-analysis-section';
            
            const metricsHeading = document.createElement('h4');
            metricsHeading.textContent = 'Coverage Metrics';
            metricsSection.appendChild(metricsHeading);
            
            createCoverageMetric('Statement Coverage', fileAnalysis.metrics.statement_coverage, metricsSection);
            createCoverageMetric('Branch Coverage', fileAnalysis.metrics.branch_coverage, metricsSection);
            createCoverageMetric('Function Coverage', fileAnalysis.metrics.function_coverage, metricsSection);
            createCoverageMetric('Condition Coverage', fileAnalysis.metrics.condition_coverage, metricsSection);
            
            content.appendChild(metricsSection);
            
            // Add uncovered areas if they exist
            if (fileAnalysis.uncovered_lines && fileAnalysis.uncovered_lines.length > 0) {
                content.appendChild(createListSection('Uncovered Lines', fileAnalysis.uncovered_lines));
            }
            
            if (fileAnalysis.uncovered_branches && fileAnalysis.uncovered_branches.length > 0) {
                content.appendChild(createListSection('Uncovered Branches', fileAnalysis.uncovered_branches));
            }
            
            if (fileAnalysis.uncovered_functions && fileAnalysis.uncovered_functions.length > 0) {
                content.appendChild(createListSection('Uncovered Functions', fileAnalysis.uncovered_functions));
            }
            
            if (fileAnalysis.missed_edge_cases && fileAnalysis.missed_edge_cases.length > 0) {
                content.appendChild(createListSection('Missed Edge Cases', fileAnalysis.missed_edge_cases));
            }
            
            // Add test improvement suggestions
            if (fileAnalysis.test_improvement_suggestions && fileAnalysis.test_improvement_suggestions.length > 0) {
                const suggestionsSection = document.createElement('div');
                suggestionsSection.className = 'file-analysis-section';
                
                const suggestionsHeading = document.createElement('h4');
                suggestionsHeading.textContent = 'Test Improvement Suggestions';
                suggestionsSection.appendChild(suggestionsHeading);
                
                fileAnalysis.test_improvement_suggestions.forEach(suggestion => {
                    const suggestionItem = document.createElement('div');
                    suggestionItem.className = 'suggestion-item';
                    
                    const description = document.createElement('div');
                    description.className = 'suggestion-description';
                    description.textContent = suggestion.description;
                    suggestionItem.appendChild(description);
                    
                    if (suggestion.implementation_hint) {
                        const hint = document.createElement('div');
                        hint.className = 'suggestion-hint';
                        hint.textContent = suggestion.implementation_hint;
                        suggestionItem.appendChild(hint);
                    }
                    
                    suggestionsSection.appendChild(suggestionItem);
                });
                
                content.appendChild(suggestionsSection);
            }
            
            // Add risk assessment
            if (fileAnalysis.risk_assessment) {
                const riskSection = document.createElement('div');
                riskSection.className = 'risk-assessment';
                
                const riskHeading = document.createElement('strong');
                riskHeading.textContent = 'Risk Assessment: ';
                riskSection.appendChild(riskHeading);
                
                const riskText = document.createTextNode(fileAnalysis.risk_assessment);
                riskSection.appendChild(riskText);
                
                content.appendChild(riskSection);
            }
            
            fileDiv.appendChild(content);
            
            // Add toggle functionality
            toggleButton.addEventListener('click', () => {
                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    toggleButton.textContent = 'Hide Details';
                } else {
                    content.classList.add('hidden');
                    toggleButton.textContent = 'Show Details';
                }
            });
            
            filesAnalysis.appendChild(fileDiv);
        });
    }

    function createListSection(title, items) {
        const section = document.createElement('div');
        section.className = 'file-analysis-section';
        
        const heading = document.createElement('h4');
        heading.textContent = title;
        section.appendChild(heading);
        
        const list = document.createElement('ul');
        list.className = 'file-analysis-list';
        
        items.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item;
            list.appendChild(listItem);
        });
        
        section.appendChild(list);
        return section;
    }
})();