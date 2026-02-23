import { useContext } from "react";
import OfflineSyncContext, {
  type OfflineSyncContextValue,
} from "../contexts/offlineSyncContext";

const useOfflineSync = (): OfflineSyncContextValue =>
  useContext(OfflineSyncContext);

export default useOfflineSync;
