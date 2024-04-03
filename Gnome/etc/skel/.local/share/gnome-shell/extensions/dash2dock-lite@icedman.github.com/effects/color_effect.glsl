uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;

void main() {
    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
    cogl_color_out = vec4(red * c.a * blend, green * c.a * blend, blue * c.a * blend, c.a * blend);
}