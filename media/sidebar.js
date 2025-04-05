(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Cache elements
    const loginSection = document.getElementById('login-section');
    const generateSection = document.getElementById('generate-tests-section');
    const resultsSection = document.getElementById('test-results-section');
    const loginButton = document.getElementById('login-button');
    const generateUnitButton = document.getElementById('generate-unit-button');
    const generateIntegrationButton = document.getElementById('generate-integration-button');
    const generateStressButton = document.getElementById('generate-stress-button');
    const applyButton = document.getElementById('apply-button');
    const cancelButton = document.getElementById('cancel-button');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const testDirectoryInput = document.getElementById('test-directory');
    const loginStatusEl = document.getElementById('login-status');
    const loginStatusMessage = document.getElementById('login-status-message');
    const testStatusMessage = document.getElementById('test-status-message');
    const testResultsList = document.getElementById('test-results-list');
    
    // Store test results
    let generatedTests = [];
    
    // Check login status when the page loads
    vscode.postMessage({ command: 'checkLoginStatus' });
    
    // Set up event listeners
    loginButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username) {
            showStatusMessage(loginStatusMessage, 'error', 'Username is required');
            return;
        }
        
        if (!password) {
            showStatusMessage(loginStatusMessage, 'error', 'Password is required');
            return;
        }
        
        vscode.postMessage({ 
            command: 'login',
            username,
            password
        });
    });
    
    generateUnitButton.addEventListener('click', () => {
        const testDir = testDirectoryInput.value.trim();
        
        if (!testDir) {
            showStatusMessage(testStatusMessage, 'error', 'Test directory is required');
            return;
        }
        
        vscode.postMessage({ 
            command: 'generateTests',
            testDir,
            testType: 'unit'
        });
    });
    
    generateIntegrationButton.addEventListener('click', () => {
        const testDir = testDirectoryInput.value.trim();
        
        if (!testDir) {
            showStatusMessage(testStatusMessage, 'error', 'Test directory is required');
            return;
        }
        
        vscode.postMessage({ 
            command: 'generateTests',
            testDir,
            testType: 'integration'
        });
    });
    
    generateStressButton.addEventListener('click', () => {
        const testDir = testDirectoryInput.value.trim();
        
        if (!testDir) {
            showStatusMessage(testStatusMessage, 'error', 'Test directory is required');
            return;
        }
        
        vscode.postMessage({ 
            command: 'generateTests',
            testDir,
            testType: 'stress'
        });
    });
    
    applyButton.addEventListener('click', () => {
        vscode.postMessage({ 
            command: 'applyTests',
            tests: generatedTests
        });
    });
    
    cancelButton.addEventListener('click', () => {
        // Clear test results and hide the section
        generatedTests = [];
        testResultsList.innerHTML = '';
        resultsSection.classList.add('hidden');
        generateSection.classList.remove('hidden');
    });
    
    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'loginStatus':
                updateLoginStatus(message.isLoggedIn);
                break;
                
            case 'updateStatus':
                handleStatusUpdate(message);
                break;
                
            case 'updateProgress':
                updateProgressMessage(message);
                break;
                
            case 'updateTestResults':
                displayTestResults(message.tests);
                break;
                
            case 'showError':
                if (message.action === 'login') {
                    showStatusMessage(loginStatusMessage, 'error', message.message);
                } else {
                    showStatusMessage(testStatusMessage, 'error', message.message);
                }
                break;
        }
    });
    
    function updateLoginStatus(isLoggedIn) {
        const statusIndicator = loginStatusEl.querySelector('.status-indicator');
        const statusText = loginStatusEl.querySelector('.status-text');
        
        if (isLoggedIn) {
            statusIndicator.classList.remove('offline');
            statusIndicator.classList.add('online');
            statusText.textContent = 'Logged in';
            
            // Show generate section, hide login section
            loginSection.classList.add('hidden');
            generateSection.classList.remove('hidden');
        } else {
            statusIndicator.classList.remove('online');
            statusIndicator.classList.add('offline');
            statusText.textContent = 'Not logged in';
            
            // Show login section, hide other sections
            loginSection.classList.remove('hidden');
            generateSection.classList.add('hidden');
            resultsSection.classList.add('hidden');
        }
    }
    
    function handleStatusUpdate(message) {
        const { status, action, message: statusMsg } = message;
        
        if (action === 'login') {
            if (status === 'loading') {
                showStatusMessage(loginStatusMessage, 'loading', statusMsg);
                loginButton.disabled = true;
            } else if (status === 'success') {
                showStatusMessage(loginStatusMessage, 'success', statusMsg);
                loginButton.disabled = false;
                
                // Check login status again to update UI
                vscode.postMessage({ command: 'checkLoginStatus' });
            } else if (status === 'error') {
                showStatusMessage(loginStatusMessage, 'error', statusMsg);
                loginButton.disabled = false;
            }
        } else if (action === 'generateTests') {
            if (status === 'loading') {
                showStatusMessage(testStatusMessage, 'loading', statusMsg);
                generateUnitButton.disabled = true;
                generateIntegrationButton.disabled = true;
                generateStressButton.disabled = true;
            } else if (status === 'success') {
                showStatusMessage(testStatusMessage, 'success', statusMsg);
                generateUnitButton.disabled = false;
                generateIntegrationButton.disabled = false;
                generateStressButton.disabled = false;
            } else if (status === 'error') {
                showStatusMessage(testStatusMessage, 'error', statusMsg);
                generateUnitButton.disabled = false;
                generateIntegrationButton.disabled = false;
                generateStressButton.disabled = false;
            }
        }
    }
    
    function updateProgressMessage(message) {
        if (message.action === 'generateTests') {
            showStatusMessage(testStatusMessage, 'loading', message.message);
        }
    }
    
    function showStatusMessage(element, type, message) {
        // Clear existing classes
        element.className = 'status-message';
        element.classList.add(type);
        
        // Clear previous content
        element.innerHTML = '';
        
        if (type === 'loading') {
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            element.appendChild(spinner);
        }
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        element.appendChild(messageSpan);
    }
    
    function displayTestResults(tests) {
        // Save the tests to our state
        generatedTests = tests;
        
        // Clear previous results
        testResultsList.innerHTML = '';
        
        // Generate the test list
        tests.forEach(test => {
            const testItem = document.createElement('div');
            testItem.className = 'test-item';
            
            const testHeader = document.createElement('div');
            testHeader.className = 'test-header';
            
            const testPath = document.createElement('div');
            testPath.className = 'test-path';
            testPath.textContent = test.filepath;
            testHeader.appendChild(testPath);
            
            const previewBtn = document.createElement('button');
            previewBtn.className = 'test-preview-btn';
            previewBtn.textContent = 'Preview';
            previewBtn.addEventListener('click', () => {
                // Send message to create and preview the file
                vscode.postMessage({
                    command: 'previewTest',
                    test: test
                });
            });
            testHeader.appendChild(previewBtn);
            
            testItem.appendChild(testHeader);
            testResultsList.appendChild(testItem);
        });
        
        // Hide generate section, show results section
        generateSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        
        // Clear loading message
        testStatusMessage.className = 'status-message';
        testStatusMessage.innerHTML = '';
    }
    
    // Log to extension
    function log(message) {
        vscode.postMessage({
            command: 'logOutput',
            text: message
        });
    }
})();