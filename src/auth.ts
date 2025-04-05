import * as vscode from 'vscode';
import axios from 'axios';

export interface LoginResponse {
    access_token: string;
    token_type: string;
}

export async function login(
    context: vscode.ExtensionContext,
    username: string,
    password: string
): Promise<boolean> {
    try {
        // Make login request to backend with all required parameters
        const response = await axios.post<LoginResponse>(
            'https://devexy-backend.azurewebsites.net/auth/login',
            new URLSearchParams({
                'grant_type': 'password',
                'username': username,
                'password': password,
                'scope': '',
                'client_id': 'string',  // Use proper client_id from your configuration
                'client_secret': 'string'  // Use proper client_secret from your configuration
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        // Store token in extension storage
        await context.secrets.store('devexy.token', response.data.access_token);
        
        // Also store username for display purposes
        await context.secrets.store('devexy.username', username);
        
        return true;
    } catch (error) {
        throw error;
    }
}

export async function getAuthToken(context: vscode.ExtensionContext): Promise<string> {
    // Try to get token from secrets storage
    let token = await context.secrets.get('devexy.token');
    
    if (!token) {
        throw new Error('Not logged in. Please log in first.');
    }
    
    return token;
}

export async function getUsername(context: vscode.ExtensionContext): Promise<string | null> {
    return await context.secrets.get('devexy.username') || null;
}

export async function logout(context: vscode.ExtensionContext): Promise<void> {
    await context.secrets.delete('devexy.token');
    await context.secrets.delete('devexy.username');
}

export async function isLoggedIn(context: vscode.ExtensionContext): Promise<boolean> {
    const token = await context.secrets.get('devexy.token');
    return !!token;
}