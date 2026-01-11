/**
 * Google Sheets API Service
 * שכבת תקשורת עם Google Apps Script
 */

// ה-URL של ה-Google Apps Script Web App
// המשתמש צריך להחליף את זה ב-URL שלו
const SCRIPT_URL = localStorage.getItem('googleScriptUrl') || '';

export const setScriptUrl = (url: string) => {
  localStorage.setItem('googleScriptUrl', url);
};

export const getScriptUrl = () => {
  return localStorage.getItem('googleScriptUrl') || '';
};

interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  [key: string]: T | boolean | string | undefined;
}

async function apiCall<T>(action: string, params: Record<string, any> = {}, body?: any): Promise<ApiResponse<T>> {
  const url = getScriptUrl();
  
  if (!url) {
    throw new Error('לא הוגדר URL של Google Apps Script');
  }

  const queryParams = new URLSearchParams({ action, ...params });
  const fullUrl = `${url}?${queryParams.toString()}`;

  try {
    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      mode: 'cors',
    };

    if (body) {
      options.headers = { 'Content-Type': 'text/plain' };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, options);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error: any) {
    console.error('API Error:', error);
    throw error;
  }
}

// ========== AUTH API ==========

export const authApi = {
  signUp: async (email: string, password: string) => {
    return apiCall('signup', { email, password });
  },
  
  signIn: async (email: string, password: string) => {
    return apiCall('signin', { email, password });
  },
};

// ========== TENANTS API ==========

export const tenantsApi = {
  getAll: async (userId: string) => {
    return apiCall('getTenants', { userId });
  },
  
  add: async (tenantData: any) => {
    return apiCall('addTenant', {}, tenantData);
  },
  
  update: async (tenantData: any) => {
    return apiCall('updateTenant', {}, tenantData);
  },
  
  delete: async (id: string) => {
    return apiCall('deleteTenant', { id });
  },
};

// ========== PAYMENTS API ==========

export const paymentsApi = {
  getAll: async (userId: string) => {
    return apiCall('getPayments', { userId });
  },
  
  create: async (paymentData: any) => {
    return apiCall('createPayment', {}, paymentData);
  },
  
  update: async (paymentData: any) => {
    return apiCall('updatePayment', {}, paymentData);
  },
};
