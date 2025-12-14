import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faBolt,
  faShield,
  faCubes,
  faCube,
  faLayerGroup,
  faFlask,
  faChartLine,
  faCheck,
  faCopy,
  faBars,
  faXmark,
  faChevronRight,
  faArrowRight,
  faExternalLink,
  faExternalLinkAlt,
  faBook,
  faCode,
  faRocket,
  faGear,
  faCog,
  faCircle,
  faLightbulb,
  faClock,
  faClockRotateLeft,
  faRotate,
  faServer,
  faBuilding,
  faExchangeAlt,
  faExclamationTriangle,
  faExclamationCircle,
  faPuzzlePiece,
  faStar,
  faBox
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};

// Icon library setup function to be called in components
export function setupIconLibrary(library: FaIconLibrary) {
  library.addIcons(
    // Solid icons
    faBolt,
    faShield,
    faCubes,
    faCube,
    faLayerGroup,
    faFlask,
    faChartLine,
    faCheck,
    faCopy,
    faBars,
    faXmark,
    faChevronRight,
    faArrowRight,
    faExternalLink,
    faExternalLinkAlt,
    faBook,
    faCode,
    faRocket,
    faGear,
    faCog,
    faCircle,
    faLightbulb,
    faClock,
    faClockRotateLeft,
    faRotate,
    faServer,
    faBuilding,
    faExchangeAlt,
    faExclamationTriangle,
    faExclamationCircle,
    faPuzzlePiece,
    faStar,
    faBox,
    // Brand icons
    faGithub
  );
}
