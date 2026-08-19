import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import HomeRoute from './pages/Home/HomeRoute';
import EditProfile from './pages/EditProfile/EditProfile';
import Dashboard from './pages/Dashboard/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import EmployerProtectedRoute from './components/EmployerProtectedRoute';
import EmployerPanel from './components/Layout/EmployerPanel';
import EmployerHome from './pages/Employer/EmployerHome';
import EmployerDashboard from './pages/Employer/EmployerDashboard';
import EmployerPostJobs from './pages/Employer/EmployerPostJobs';
import EmployerCheckStatus from './pages/Employer/EmployerCheckStatus';
import EmployerMessages from './pages/Employer/EmployerMessages';
import EmployerNotifications from './pages/Employer/EmployerNotifications';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLayout from './components/Layout/AdminLayout';
import AdminOverview from './pages/Admin/AdminOverview';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminVerification from './pages/Admin/AdminVerification';
import AdminGigs from './pages/Admin/AdminGigs';
import AdminFlags from './pages/Admin/AdminFlags';
import AdminTemplates from './pages/Admin/AdminTemplates';
import AdminAnalytics from './pages/Admin/AdminAnalytics';
import AdminJobPosts from './pages/Admin/AdminJobPosts';
import AdminUserProfile from './pages/Admin/AdminUserProfile';
import AdminManagement from './pages/Admin/AdminManagement';
import AdminAds from './pages/Admin/AdminAds';
import AdminFeatured from './pages/Admin/AdminFeatured';
import AdminBadges from './pages/Admin/AdminBadges';
import SuperAdminRoute from './components/SuperAdminRoute';
import FindJobs from './pages/FindJobs/FindJobs';
import PublicJobView from './pages/FindJobs/PublicJobView';
import TaskWorkspace from './pages/TaskWorkspace/TaskWorkspace';
import FreelancerMessages from './pages/Messages/FreelancerMessages';
import TalentProfile from './pages/Talent/TalentProfile';
import Wallet from './pages/Wallet/Wallet';
import WalletCallback from './pages/Wallet/WalletCallback';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomeRoute />} />
          <Route path="find-jobs" element={<FindJobs />} />
          <Route path="jobs/:jobId" element={<PublicJobView />} />
          <Route path="talent/:userId" element={<TalentProfile />} />
          <Route
            path="dashboard"
            element={(
              <ProtectedRoute allowedRoles={['freelancer']}>
                <Dashboard />
              </ProtectedRoute>
            )}
          />
          <Route
            path="dashboard/workspace/:sessionId"
            element={(
              <ProtectedRoute allowedRoles={['freelancer']}>
                <TaskWorkspace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="wallet/callback"
            element={(
              <ProtectedRoute allowedRoles={['freelancer']}>
                <WalletCallback />
              </ProtectedRoute>
            )}
          />
          <Route
            path="wallet"
            element={(
              <ProtectedRoute allowedRoles={['freelancer']}>
                <Wallet />
              </ProtectedRoute>
            )}
          />
          <Route
            path="messages"
            element={(
              <ProtectedRoute allowedRoles={['freelancer']}>
                <FreelancerMessages />
              </ProtectedRoute>
            )}
          />
          <Route
            path="profile/edit"
            element={(
              <ProtectedRoute allowedRoles={['freelancer']}>
                <EditProfile />
              </ProtectedRoute>
            )}
          />
        </Route>

        <Route
          path="employer"
          element={(
            <EmployerProtectedRoute>
              <EmployerPanel />
            </EmployerProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="home" element={<EmployerHome />} />
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="post-jobs" element={<EmployerPostJobs />} />
          <Route path="check-status" element={<EmployerCheckStatus />} />
          <Route path="workspace/:sessionId" element={<TaskWorkspace />} />
          <Route path="wallet/callback" element={<WalletCallback />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="messages" element={<EmployerMessages />} />
          <Route path="notifications" element={<EmployerNotifications />} />
        </Route>

        <Route
          path="admin"
          element={(
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserProfile />} />
          <Route path="verification" element={<AdminVerification />} />
          <Route path="jobs" element={<AdminJobPosts />} />
          <Route path="gigs" element={<AdminGigs />} />
          <Route path="ads" element={<AdminAds />} />
          <Route path="featured" element={<AdminFeatured />} />
          <Route path="badges" element={<AdminBadges />} />
          <Route path="flags" element={<AdminFlags />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="analytics" element={<SuperAdminRoute><AdminAnalytics /></SuperAdminRoute>} />
          <Route path="management" element={<SuperAdminRoute><AdminManagement /></SuperAdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
