#version 300 es
precision highp float;

// Environment reflection: sample the active HDRI with the reflected view
// direction and mix the result over a simple diffuse base.
//
// environmentMap is the scene cubemap the preview already binds, so no texture
// slot or User data row is needed.

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform samplerCube environmentMap;

out vec4 fragColor;

void main(void)
{
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPos - vWorldPosition);
    vec3 reflected = reflect(-viewDirection, normal);

    vec3 environment = texture(environmentMap, reflected).rgb;
    float NdotL = max(dot(normal, normalize(lightDir)), 0.0);

    vec3 base = albedo * (0.15 + 0.85 * NdotL);
    vec3 color = mix(base, environment, reflectivity);

    fragColor = vec4(color, 1.0);
}
