/**
 * Capillary-gravity wave trains plus ripples above the bubble column (agitation: xz position, height).
 * Returns the height and its gradient; the surface shades with it and the water pass reflects with it.
 */
export const WAVES_GLSL = /* glsl */ `
float waves( vec2 p, float t, vec3 agitation, out vec2 grad ) {
  const vec2 dirs[ 7 ] = vec2[]( vec2( 1.0, 0.2 ), vec2( -0.6, 1.0 ), vec2( 0.8, -0.7 ), vec2( -1.0, -0.35 ), vec2( 0.25, 1.0 ), vec2( 0.7, 0.55 ), vec2( -0.3, -1.0 ) );
  const float lens[ 7 ] = float[]( 0.23, 0.14, 0.09, 0.061, 0.038, 0.024, 0.016 );
  float h = 0.0;
  grad = vec2( 0.0 );
  for ( int i = 0; i < 7; i++ ) {
    vec2 d = normalize( dirs[ i ] );
    float k = 6.2831853 / lens[ i ];
    float w = sqrt( 9.81 * k + 7.4e-5 * k * k * k );
    float a = lens[ i ] * 0.0075;
    float ph = k * dot( d, p ) - w * t * 0.45 + float( i ) * 1.7;
    h += a * sin( ph );
    grad += a * k * d * cos( ph );
  }
  vec2 r = p - agitation.xy;
  float rl = length( r ) + 1e-4;
  float env = agitation.z * exp( -rl * 9.0 );
  float ph = rl * 140.0 - t * 14.0;
  h += env * sin( ph );
  grad += env * ( 140.0 * cos( ph ) - 9.0 * sin( ph ) ) * ( r / rl );
  return h;
}

vec3 waveNormal( vec2 p, float t, vec3 agitation ) {
  vec2 grad;
  waves( p, t, agitation, grad );
  return normalize( vec3( -grad.x, 1.0, -grad.y ) );
}
`;
