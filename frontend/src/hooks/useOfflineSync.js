import { useContext } from "react";
import OfflineSyncContext from "../contexts/offlineSyncContext.js";

const useOfflineSync = () => useContext(OfflineSyncContext);

export default useOfflineSync;
