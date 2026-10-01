import { mountCrownfall } from "./crownfall/ui";
import "./crownfall/crownfall.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) mountCrownfall(root);
