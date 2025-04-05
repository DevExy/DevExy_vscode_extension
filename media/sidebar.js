(function() {
    // Get VSCode API
    const vscode = acquireVsCodeApi();
    
    // Store current login state
    let isCurrentlyLoggedIn = false;

    // Test analysis UI elements (updated)
    const testAnalysisSection = document.getElementById('test-analysis-section');
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

    // Test priority analysis UI elements (updated - no need for separate file selection)
    const priorityResultsSection = document.getElementById('priority-results-section');
    const analyzePriorityButton = document.getElementById('analyze-priority-button');
    const closePriorityButton = document.getElementById('close-priority-button');
    const criticalityContextInput = document.getElementById('criticality-context');
    const priorityStatusMessage = document.getElementById('priority-status-message');
    const prioritySummary = document.getElementById('priority-summary');
    const testPriorities = document.getElementById('test-priorities');
    const securityVulnerabilities = document.getElementById('security-vulnerabilities');
    const priorityVisualization = document.getElementById('priority-visualization');
    const priorityRecommendations = document.getElementById('priority-recommendations');

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

    // Add event listeners for test priority analysis
    analyzePriorityButton.addEventListener('click', () => {
        checkLoginAndExecute(() => {
            const context = criticalityContextInput.value.trim();
            vscode.postMessage({ 
                command: 'updateCriticalityContext',
                context: context
            });
            vscode.postMessage({ command: 'analyzeTestPriority' });
        });
    });

    closePriorityButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'closePriorityResults' });
    });

    criticalityContextInput.addEventListener('change', () => {
        vscode.postMessage({ 
            command: 'updateCriticalityContext',
            context: criticalityContextInput.value.trim()
        });
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
            loginSection.classList.remove('hidden');
            generateTestsSection.classList.add('hidden');
            testAnalysisSection.classList.add('hidden');
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
                
                if (!message.isLoggedIn) {
                    loginSection.classList.remove('hidden');
                    generateTestsSection.classList.add('hidden');
                    testAnalysisSection.classList.add('hidden');
                    testResultsSection.classList.add('hidden');
                    coverageResultsSection.classList.add('hidden');
                    priorityResultsSection.classList.add('hidden');
                } else {
                    loginSection.classList.add('hidden');
                    generateTestsSection.classList.remove('hidden');
                    testAnalysisSection.classList.remove('hidden');
                }
                break;
            
            case 'updateStatus':
                if (message.action === 'login') {
                    updateLoginStatus(message.status, message.message);
                    
                    if (message.status === 'success') {
                        isCurrentlyLoggedIn = true;
                        loginSection.classList.add('hidden');
                        generateTestsSection.classList.remove('hidden');
                        coverageAnalysisSection.classList.remove('hidden');
                        priorityAnalysisSection.classList.remove('hidden');
                    }
                } else if (message.action === 'generateTests') {
                    updateTestStatus(message.status, message.message);
                } else if (message.action === 'coverage') {
                    updateCoverageStatus(message.status, message.message);
                } else if (message.action === 'priority') {
                    updatePriorityStatus(message.status, message.message);
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
                
            case 'updatePriorityResults':
                displayPriorityResults(message.results);
                break;

            case 'hidePriorityResults':
                priorityResultsSection.classList.add('hidden');
                priorityAnalysisSection.classList.remove('hidden');
                break;
                
            case 'updateProgress':
                if (message.action === 'coverage') {
                    updateCoverageStatus('loading', message.message);
                } else if (message.action === 'priority') {
                    updatePriorityStatus('loading', message.message);
                }
                break;
                
            case 'showError':
                if (message.action === 'coverage') {
                    updateCoverageStatus('error', message.message);
                } else if (message.action === 'priority') {
                    updatePriorityStatus('error', message.message);
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
            testAnalysisSection.classList.remove('hidden');
            isCurrentlyLoggedIn = true;
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'Not logged in';
            loginSection.classList.remove('hidden');
            generateTestsSection.classList.add('hidden');
            testAnalysisSection.classList.add('hidden');
            testResultsSection.classList.add('hidden');
            coverageResultsSection.classList.add('hidden');
            priorityResultsSection.classList.add('hidden');
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
        testResultsList.innerHTML = '';
        
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

    function updatePriorityStatus(status, message) {
        priorityStatusMessage.innerHTML = message;
        
        if (status === 'success') {
            priorityStatusMessage.className = 'status-message success';
        } else if (status === 'error') {
            priorityStatusMessage.className = 'status-message error';
        } else if (status === 'loading') {
            priorityStatusMessage.className = 'status-message loading';
        } else {
            priorityStatusMessage.className = 'status-message';
        }
    }
    
    function updateFilesList(listElement, files) {
        listElement.innerHTML = '';
        
        if (files && files.length > 0) {
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.textContent = file;
                listElement.appendChild(fileItem);
            });
        } else {
            const noFiles = document.createElement('p');
            noFiles.className = 'info-text';
            noFiles.textContent = 'No files selected';
            listElement.appendChild(noFiles);
        }
    }

    function displayCoverageResults(results) {
        testAnalysisSection.classList.add('hidden');
        coverageResultsSection.classList.remove('hidden');
        
        displayCoverageSummary(results.summary);
        displayRecommendations(results.summary.recommendations);
        displayVisualizations(results.visualization_data);
        displayFilesAnalysis(results.files_analysis);
        addDownloadReportButton();
        
        coverageStatusMessage.className = 'status-message';
        coverageStatusMessage.innerHTML = '';
    }

    function displayPriorityResults(results) {
        testAnalysisSection.classList.add('hidden');
        priorityResultsSection.classList.remove('hidden');
        
        displayPrioritySummary(results.summary);
        displayTestPriorities(results.test_priorities);
        displaySecurityVulnerabilities(results.security_vulnerabilities);
        displayPriorityVisualizations(results.visualization_data);
        displayPriorityRecommendations(results.recommendations);
        
        priorityStatusMessage.className = 'status-message';
        priorityStatusMessage.innerHTML = '';
    }

    function displayCoverageSummary(summary) {
        coverageSummary.innerHTML = '';
        
        const summaryHeading = document.createElement('h3');
        summaryHeading.textContent = 'Overall Coverage';
        coverageSummary.appendChild(summaryHeading);
        
        const metrics = summary.overall_coverage;
        
        createCoverageMetric('Statement Coverage', metrics.statement_coverage, coverageSummary);
        createCoverageMetric('Branch Coverage', metrics.branch_coverage, coverageSummary);
        createCoverageMetric('Function Coverage', metrics.function_coverage, coverageSummary);
        createCoverageMetric('Condition Coverage', metrics.condition_coverage, coverageSummary);
    }

    function displayPrioritySummary(summary) {
        prioritySummary.innerHTML = '';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'priority-header';
        
        const assessmentDiv = document.createElement('div');
        assessmentDiv.className = 'priority-assessment';
        
        const assessmentTitle = document.createElement('h3');
        assessmentTitle.textContent = 'Overall Assessment';
        assessmentDiv.appendChild(assessmentTitle);
        
        const assessmentText = document.createElement('p');
        assessmentText.textContent = summary.overall_assessment;
        assessmentDiv.appendChild(assessmentText);
        
        headerDiv.appendChild(assessmentDiv);
        
        const statsDiv = document.createElement('div');
        statsDiv.className = 'priority-stats';
        
        const statsTitle = document.createElement('h3');
        statsTitle.textContent = 'Risk Statistics';
        statsDiv.appendChild(statsTitle);
        
        const statsGrid = document.createElement('div');
        statsGrid.className = 'stats-grid';
        
        createStatItem(statsGrid, 'High Risk Tests', summary.high_risk_count, 'high-risk');
        createStatItem(statsGrid, 'Medium Risk Tests', summary.medium_risk_count, 'medium-risk');
        createStatItem(statsGrid, 'Low Risk Tests', summary.low_risk_count, 'low-risk');
        createStatItem(statsGrid, 'Security Issues', summary.security_vulnerability_count, 'security-risk');
        createStatItem(statsGrid, 'Top Priority Tests', summary.top_priority_tests_count, 'top-priority');
        
        statsDiv.appendChild(statsGrid);
        headerDiv.appendChild(statsDiv);
        
        const areasDiv = document.createElement('div');
        areasDiv.className = 'critical-areas';
        
        const areasTitle = document.createElement('h3');
        areasTitle.textContent = 'Critical Areas';
        areasDiv.appendChild(areasTitle);
        
        const areasList = document.createElement('ul');
        areasList.className = 'critical-areas-list';
        
        summary.critical_areas.forEach(area => {
            const areaItem = document.createElement('li');
            areaItem.textContent = area;
            areasList.appendChild(areaItem);
        });
        
        areasDiv.appendChild(areasList);
        
        prioritySummary.appendChild(headerDiv);
        prioritySummary.appendChild(areasDiv);
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

    function createStatItem(container, label, value, className) {
        const statItem = document.createElement('div');
        statItem.className = `stat-item ${className}`;
        
        const statValue = document.createElement('div');
        statValue.className = 'stat-value';
        statValue.textContent = value;
        
        const statLabel = document.createElement('div');
        statLabel.className = 'stat-label';
        statLabel.textContent = label;
        
        statItem.appendChild(statValue);
        statItem.appendChild(statLabel);
        
        container.appendChild(statItem);
    }

    function displayRecommendations(recommendations) {
        coverageRecommendations.innerHTML = '';
        
        if (!recommendations || recommendations.length === 0) {
            return;
        }
        
        const heading = document.createElement('h3');
        heading.textContent = 'Recommendations';
        coverageRecommendations.appendChild(heading);
        
        const list = document.createElement('ul');
        list.className = 'recommendations-list';
        
        recommendations.forEach(recommendation => {
            const item = document.createElement('li');
            item.textContent = recommendation;
            list.appendChild(item);
        });
        
        coverageRecommendations.appendChild(list);
    }

    function displayPriorityRecommendations(recommendations) {
        priorityRecommendations.innerHTML = '';
        
        if (!recommendations || recommendations.length === 0) {
            return;
        }
        
        const header = document.createElement('h3');
        header.textContent = 'Recommendations';
        priorityRecommendations.appendChild(header);
        
        const list = document.createElement('ul');
        list.className = 'recommendations-list';
        
        recommendations.forEach(recommendation => {
            const item = document.createElement('li');
            item.textContent = recommendation;
            list.appendChild(item);
        });
        
        priorityRecommendations.appendChild(list);
    }

    function displayVisualizations(visualizationData) {
        coverageVisualization.innerHTML = '';
        
        if (!visualizationData) {
            return;
        }
        
        const heading = document.createElement('h3');
        heading.textContent = 'Coverage Visualizations';
        coverageVisualization.appendChild(heading);
        
        if (visualizationData.summary_chart_data && visualizationData.summary_chart_data.length > 0) {
            displaySummaryChart(visualizationData.summary_chart_data);
        }
        
        if (visualizationData.improvement_potential_chart && visualizationData.improvement_potential_chart.length > 0) {
            displayImprovementPotentialChart(visualizationData.improvement_potential_chart);
        }
        
        if (visualizationData.missed_test_cases_chart && visualizationData.missed_test_cases_chart.length > 0) {
            displayMissedTestCasesChart(visualizationData.missed_test_cases_chart);
        }
        
        if (visualizationData.heatmap_data && visualizationData.heatmap_data.length > 0) {
            displayHeatmapData(visualizationData.heatmap_data);
        }
    }

    function displayPriorityVisualizations(visualizationData) {
        priorityVisualization.innerHTML = '';
        
        const header = document.createElement('h3');
        header.textContent = 'Priority Visualizations';
        priorityVisualization.appendChild(header);
        
        if (!visualizationData) {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No visualization data available.';
            priorityVisualization.appendChild(emptyMessage);
            return;
        }
        
        const visualizationContainer = document.createElement('div');
        visualizationContainer.className = 'priority-visualization-container';
        
        if (visualizationData.priority_distribution) {
            const distributionSection = document.createElement('div');
            distributionSection.className = 'visualization-section';
            
            const distributionTitle = document.createElement('h4');
            distributionTitle.textContent = 'Test Priority Distribution';
            distributionSection.appendChild(distributionTitle);
            
            const distributionChart = createPriorityDistributionChart(visualizationData.priority_distribution);
            distributionSection.appendChild(distributionChart);
            
            visualizationContainer.appendChild(distributionSection);
        }
        
        if (visualizationData.risk_category_distribution) {
            const categorySection = document.createElement('div');
            categorySection.className = 'visualization-section';
            
            const categoryTitle = document.createElement('h4');
            categoryTitle.textContent = 'Risk Category Distribution';
            categorySection.appendChild(categoryTitle);
            
            const categoryChart = createRiskCategoryChart(visualizationData.risk_category_distribution);
            categorySection.appendChild(categoryChart);
            
            visualizationContainer.appendChild(categorySection);
        }
        
        if (visualizationData.critical_tests_by_module) {
            const moduleSection = document.createElement('div');
            moduleSection.className = 'visualization-section';
            
            const moduleTitle = document.createElement('h4');
            moduleTitle.textContent = 'Critical Tests by Module';
            moduleSection.appendChild(moduleTitle);
            
            const moduleChart = createModuleDistributionChart(visualizationData.critical_tests_by_module);
            moduleSection.appendChild(moduleChart);
            
            visualizationContainer.appendChild(moduleSection);
        }
        
        if (visualizationData.security_impact_scores && visualizationData.security_impact_scores.length > 0) {
            const securitySection = document.createElement('div');
            securitySection.className = 'visualization-section';
            
            const securityTitle = document.createElement('h4');
            securityTitle.textContent = 'Security Impact Scores';
            securitySection.appendChild(securityTitle);
            
            const securityChart = createSecurityImpactChart(visualizationData.security_impact_scores);
            securitySection.appendChild(securityChart);
            
            visualizationContainer.appendChild(securitySection);
        }
        
        priorityVisualization.appendChild(visualizationContainer);
    }

    function displayFilesAnalysis(filesAnalysis) {
        filesAnalysis.innerHTML = '';
        
        if (!filesAnalysis || filesAnalysis.length === 0) {
            return;
        }
        
        const heading = document.createElement('h3');
        heading.textContent = 'Files Analysis';
        filesAnalysis.appendChild(heading);
        
        filesAnalysis.forEach(fileAnalysis => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-analysis';
            
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
            
            const content = document.createElement('div');
            content.className = 'file-analysis-content hidden';
            
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

    function addDownloadReportButton() {
        let downloadButton = document.getElementById('download-report-button');
        if (downloadButton) {
            return;
        }
        
        downloadButton = document.createElement('button');
        downloadButton.id = 'download-report-button';
        downloadButton.className = 'primary-button download-button';
        downloadButton.textContent = 'Download PDF Report';
        downloadButton.addEventListener('click', downloadReportAsPDF);
        
        const buttonGroup = coverageResultsSection.querySelector('.button-group');
        buttonGroup.insertBefore(downloadButton, buttonGroup.firstChild);
    }
})();