import axios from 'axios';

// --------------------------------------------------
// IN-MEMORY JWT ACCESS TOKEN STORE
// --------------------------------------------------
let memoryToken = null;

export const getAccessToken = () => memoryToken;

export const setAccessToken = (token) => {
  memoryToken = token;
};

// --------------------------------------------------
// SINGLE RENDER GATEWAY BASE URL
// --------------------------------------------------
const BASE_URL =
  import.meta.env.VITE_DJANGO_API_URL ||
  'http://127.0.0.1:8000';

// --------------------------------------------------
// SERVICE ROUTES
// --------------------------------------------------
export const DJANGO_BASE_URL = `${BASE_URL}/api`;

export const FASTAPI_BASE_URL = `${BASE_URL}/simulate`;

export const FLASK_BASE_URL = `${BASE_URL}/ai`;

// --------------------------------------------------
// AXIOS INSTANCES
// --------------------------------------------------
export const djangoApi = axios.create({
  baseURL: DJANGO_BASE_URL,
  withCredentials: true,
});

export const fastapiApi = axios.create({
  baseURL: FASTAPI_BASE_URL,
});

export const flaskApi = axios.create({
  baseURL: FLASK_BASE_URL,
});

// --------------------------------------------------
// REQUEST INTERCEPTOR
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
// TOKEN REFRESH FLOW
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

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
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
        const refreshResponse = await axios.post(
          `${DJANGO_BASE_URL}/auth/refresh/`,
          {},
          { withCredentials: true }
        );

        const { access_token } = refreshResponse.data;

        setAccessToken(access_token);

        originalRequest.headers.Authorization =
          `Bearer ${access_token}`;

        processQueue(null, access_token);

        return djangoApi(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);

        setAccessToken(null);

        window.dispatchEvent(
          new Event('auth_session_expired')
        );

        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
