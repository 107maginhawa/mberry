import "../src/ladle-globals.css"
import type { GlobalProvider } from "@ladle/react"

export const Provider: GlobalProvider = ({ children }) => (
  <div className="p-4">{children}</div>
)
