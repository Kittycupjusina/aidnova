import { createContext, ReactNode, useContext, useState } from "react";
import { GenericStringInMemoryStorage, GenericStringStorage } from "@/fhevm/GenericStringStorage";

interface UseInMemoryStorageState { storage: GenericStringStorage; }
const InMemoryStorageContext = createContext<UseInMemoryStorageState | undefined>(undefined);

export const useInMemoryStorage = () => {
  const ctx = useContext(InMemoryStorageContext);
  if (!ctx) throw new Error("useInMemoryStorage must be used within a InMemoryStorageProvider");
  return ctx;
};

export const InMemoryStorageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storage] = useState<GenericStringStorage>(new GenericStringInMemoryStorage());
  return <InMemoryStorageContext.Provider value={{ storage }}>{children}</InMemoryStorageContext.Provider>;
};


