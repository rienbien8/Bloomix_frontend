declare global {
  interface Window {
    google: any;
  }

  namespace google {
    namespace maps {
      class Map {
        constructor(element: HTMLElement, options?: any);
        setCenter(position: { lat: number; lng: number }): void;
        setZoom(zoom: number): void;
        getCenter(): { lat(): number; lng(): number };
        getBounds(): any;
        addListener(event: string, handler: Function): any;
      }

      class Marker {
        constructor(options: any);
        setMap(map: any): void;
        addListener(event: string, handler: Function): void;
      }

      class InfoWindow {
        constructor();
        setContent(content: string): void;
        open(options: any): void;
      }

      namespace event {
        function removeListener(listener: any): void;
      }
    }
  }
}

export {};
