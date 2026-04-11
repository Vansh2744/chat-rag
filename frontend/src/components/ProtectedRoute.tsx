import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "./context/userContext";
import { Spinner } from "../components/ui/spinner";

export default function ProtectedRoute({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { user, loading } = useCurrentUser();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );

  if (!user?.id) return <Navigate to="/auth" replace />;

  return children ? <>{children}</> : <Outlet />;
}
