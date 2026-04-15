declare module 'satellite' {
  export function twoline2satrec(line1: string, line2: string): SatRec;
  export function propagate(satrec: SatRec, date: Date): PositionAndVelocity;
  export function gstime(date: Date): number;
  export function eciToGeodetic(position: Position, gmst: number): Geodetic;
  
  export interface SatRec {
    propagate(date: Date): PositionAndVelocity;
  }
  
  export interface PositionAndVelocity {
    position: Position | false;
    velocity: Velocity | false;
  }
  
  export interface Position {
    x: number;
    y: number;
    z: number;
  }
  
  export interface Velocity {
    x: number;
    y: number;
    z: number;
  }
  
  export interface Geodetic {
    longitude: number;
    latitude: number;
    height: number;
  }
}
