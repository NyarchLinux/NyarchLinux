
// clip shadow in a simple way
void main() {
  vec4 color = cogl_color_out;
  float gray = (color.r + color.g + color.b) / 3.0;
  cogl_color_out *= (1.0 - smoothstep(0.4, 1.0, gray)) * color.a; 
}