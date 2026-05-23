import axios from 'axios';

// --------------------------------------------------
// IN-MEMORY JWT ACCESS TOKEN STORE (SECURE FRONTEND MEMORY)
// --------------------------------------------------
let memoryToken = null;

export const getAccessToken = () => memoryToken;

export const setAccessToken = (token) => {
  memoryToken = token;
};

// --------------------------------------------------
// API BASE URL CONFIGURATIONS WITH ENV FALLBACKS
// --------------------------------------------------
export const DJANGO_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://127.0.0.1:8000';

const rawFastapiUrl = import.meta.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8002';
export const FASTAPI_BASE_URL = (rawFastapiUrl.includes('onrender.com') && !rawFastapiUrl.includes('/api/simulator'))
  ? `${rawFastapiUrl.replace(/\/+$/, '')}/api/simulator`
  : rawFastapiUrl;

const rawFlaskUrl = import.meta.env.VITE_AI_ENGINE_URL || 'http://127.0.0.1:8003';
export const FLASK_BASE_URL = (rawFlaskUrl.includes('onrender.com') && !rawFlaskUrl.includes('/api/ai'))
  ? `${rawFlaskUrl.replace(/\/+$/, '')}/api/ai`
  : rawFlaskUrl;

// --------------------------------------------------
// AXIOS INSTANCES SETUP
// --------------------------------------------------
export const djangoApi = axios.create({
  baseURL: `${DJANGO_BASE_URL}/api`,
  withCredentials: true, // Crucial for HTTP-Only Refresh cookies
});

export const fastapiApi = axios.create({
  baseURL: FASTAPI_BASE_URL,
});

export const flaskApi = axios.create({
  baseURL: FLASK_BASE_URL,
});

// --------------------------------------------------
// REQUEST INTERCEPTOR: AUTOMATIC ACCESS TOKEN INJECTION
// --------------------------------------------------
djangoApi.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --------------------------------------------------
// RESPONSE INTERCEPTOR: SECURE SLIENT TOKEN ROTATION (REFRESH FLOW)
// --------------------------------------------------
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  refreshQueue = [];
};

djangoApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Detect expired token response and verify we aren't looping infinitely
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Avoid refreshing on actual login/register/refresh failure routes
      if (
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return djangoApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Trigger token rotation (refresh token sent via cookie automatically)
        const refreshResponse = await axios.post(
          `${DJANGO_BASE_URL}/api/auth/refresh/`,
          {},
          { withCredentials: true }
        );

        const { access_token } = refreshResponse.data;
        setAccessToken(access_token);

        // Update Authorization header on original failed call
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null, access_token);
        return djangoApi(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        // Dispatch custom global event to redirect to login if refresh fails
        window.dispatchEvent(new Event('auth_session_expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
