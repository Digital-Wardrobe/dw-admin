import React from 'react';
import { Navigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const token = localStorage.getItem('admin_session_token');
  const userJson = localStorage.getItem('admin_user');
  
  if (!token || !userJson) {
    return <Navigate to="/" replace />;
  }

  try {
    const user = JSON.parse(userJson);
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      return <>{children}</>;
    }
  } catch (err) {
    console.error("AuthGuard user verification error:", err);
  }

  // If not matching administration roles, bounce back to public site / home
  return <Navigate to="/" replace />;
}
