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

    // Handle messages from the extension
    function handleMessage(message) {
        switch (message.command) {
            case 'loginStatus':
                updateAuthStatus(message.isLoggedIn, message.username);
                isCurrentlyLoggedIn = message.isLoggedIn;
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
                
            case 'updateStatus':
                if (message.action === 'coverage') {
                    updateCoverageStatus(message.status, message.message);
                }
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
        
        // Display file analysis
        displayFilesAnalysis(results.files_analysis);
        
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