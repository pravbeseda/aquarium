/**
 * GLSL shared by the water pass and the water surface: the room outside the tank is a blurred
 * HDRI projected onto a sphere around the tank, so moving inside the tank gives real parallax.
 */
export const ROOM_PARS = /* glsl */ `
uniform samplerCube tRoom;
uniform mat3 uRoomRot;
uniform vec3 uRoomCenter;
uniform float uRoomRadius;
uniform float uRoomIntensity;

vec3 sampleRoom( vec3 origin, vec3 dir, float lod ) {
  vec3 oc = origin - uRoomCenter;
  float b = dot( oc, dir );
  float c = dot( oc, oc ) - uRoomRadius * uRoomRadius;
  float t = -b + sqrt( max( b * b - c, 0.0 ) );
  vec3 q = normalize( oc + dir * t );
  vec3 col = textureLod( tRoom, uRoomRot * q, lod ).rgb;
  // Soft-clip the sunlit window so it glows instead of blowing out the whole glass.
  return col / ( 1.0 + max( max( col.r, col.g ), col.b ) * 0.12 ) * uRoomIntensity;
}

// Unpolarised Fresnel reflectance leaving water (n = 1.333) into air; 1.0 means total internal reflection.
float waterToAirFresnel( float cosI ) {
  const float eta = 1.333;
  float sinT2 = eta * eta * ( 1.0 - cosI * cosI );
  if ( sinT2 >= 1.0 ) return 1.0;
  float cosT = sqrt( 1.0 - sinT2 );
  float rs = ( eta * cosI - cosT ) / ( eta * cosI + cosT );
  float rp = ( cosI - eta * cosT ) / ( cosI + eta * cosT );
  return 0.5 * ( rs * rs + rp * rp );
}
`;
