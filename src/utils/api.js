import axios from 'axios';

const PROD_SERVER = 'https://projectx-f4em.onrender.com';
const isDev = window.location.hostname === 'localhost';
const API_BASE = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:5000/api' : `${PROD_SERVER}/api`);
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (isDev ? 'http://localhost:5000' : PROD_SERVER);

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
