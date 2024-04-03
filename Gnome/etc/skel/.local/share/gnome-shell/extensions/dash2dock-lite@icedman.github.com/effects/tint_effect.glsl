uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;

void main() {
    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
    vec3 pix_color = c.rgb;
    vec3 color = vec3(red * c.a, green * c.a, blue * c.a);
    cogl_color_out = vec4(mix(pix_color, color, blend), c.a);
}