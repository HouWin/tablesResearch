import { ModuleRegistry } from 'ag-grid-community'
import {
  AllEnterpriseModule,
  ValidationModule,
} from 'ag-grid-enterprise'

// 注册 AG Grid Enterprise 所有模块
ModuleRegistry.registerModules([
  AllEnterpriseModule,
  ValidationModule,
])
