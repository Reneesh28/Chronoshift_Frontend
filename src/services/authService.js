import { djangoApi, setAccessToken } from './api';

let activeRefreshPromise = null;

export const authService = {
  async register(username, email, password) {
    const response = await djangoApi.post('/auth/register/', {
      username,
      email,
      password,
    });
    if (response.data?.access_token) {
      setAccessToken(response.data.access_token);
    }
    return response.data;
  },

  async login(username, password) {
    const response = await djangoApi.post('/auth/login/', {
      username,
      password,
    });
    if (response.data?.access_token) {
      setAccessToken(response.data.access_token);
    }
    return response.data;
  },

  async refresh() {
    if (activeRefreshPromise) {
      return activeRefreshPromise;
    }
    activeRefreshPromise = (async () => {
      try {
        const response = await djangoApi.post('/auth/refresh/');
        if (response.data?.access_token) {
          setAccessToken(response.data.access_token);
        }
        return response.data;
      } finally {
        activeRefreshPromise = null;
      }
    })();
    return activeRefreshPromise;
  },

  async logout() {
    const response = await djangoApi.post('/auth/logout/');
    setAccessToken(null);
    return response.data;
  },

  async getProfile() {
    const response = await djangoApi.get('/auth/profile/');
    return response.data;
  },
};
