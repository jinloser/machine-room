declare module "*.vue" {
  import type { App, DefineComponent } from "vue"
  const component: DefineComponent<{}, {}, any>
  export default component
}
declare module "*.scss" {
  const scss: Record<string, string>
  export default scss
}
