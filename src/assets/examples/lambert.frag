#version 300 es
precision highp float;

in vec3 vWorldNormal;

uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 N = normalize(vWorldNormal);   // Surface normals in world space.
    vec3 L = normalize(lightDir);       // Light direction (also in world space).

    /* The Lambertian reflectance model is based on the cosine of the angle between 
    the surface normal and the light direction. The dot product of the normalized
    normal vector (N) and the normalized light direction vector (L) gives us this 
    cosine value. We use `max(dot(N, L), 0.0)` to ensure that any negative values
    are zeroed. */
    float NdotL = max(dot(N, L), 0.0); 

    /* The final color equals albedo (from user data) multiplied by the Lambertian
    reflectance factor (NdotL). */
    vec3 finalColor = albedo * NdotL;

    fragColor = vec4(finalColor, 1.0);
}
