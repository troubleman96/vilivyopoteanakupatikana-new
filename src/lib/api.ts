import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {

        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token refresh or logout on 401
api.interceptors.response.use(
    (response) => {

        return response;
    },
    async (error) => {

        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {

                    const response = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, {
                        refresh: refreshToken,
                    });
                    const { access } = response.data.data;
                    localStorage.setItem('access_token', access);
                    originalRequest.headers.Authorization = `Bearer ${access}`;

                    return api(originalRequest);
                } catch (refreshError) {

                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                }
            } else {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
