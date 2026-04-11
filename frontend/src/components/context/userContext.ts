import { createContext, useContext } from "react";
import { type CurrentUser } from "../../types";

export const UserContext = createContext({
  user: null as CurrentUser | null,
  loading: true,  
  fetchCurrentUser: () => {},
  clearUser: () => {},
  logout: async () => {},
});

export const useCurrentUser = () => {
  return useContext(UserContext);
};

