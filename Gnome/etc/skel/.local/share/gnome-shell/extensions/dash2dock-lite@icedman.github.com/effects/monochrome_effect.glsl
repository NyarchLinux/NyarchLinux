uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;

vec3 greyscale(vec3 color, float str) {
    float g = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(color, vec3(g), str);
}

vec3 greyscale(vec3 color) {
    return greyscale(color, 1.0);
}

void main() {
    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
    vec3 pix_color = greyscale(c.rgb);
    vec3 color = vec3(red * c.a, green * c.a, blue * c.a);

    cogl_color_out = vec4(mix(pix_color, color, blend), c.a);
}