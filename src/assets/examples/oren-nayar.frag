#version 300 es
precision highp float;

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightDir);
    vec3 V = normalize(cameraPos - vWorldPosition);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);

    /* A rough-diffuse model: the surface is treated as V-shaped microfacets, so the
     reflected energy also depends on the view angle (retro-reflection) and the
     material does not flatten out at grazing angles the way Lambert does.
     A sigma of 0 degenerates back into Lambert.*/
    float sigma2 = sigma * sigma;
    float A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
    float B = 0.45 * sigma2 / (sigma2 + 0.09);

    // The model needs the azimuth between light and eye around N. Their
    // projections onto the tangent plane are undefined when either one is
    // parallel to N, and the correction term vanishes there anyway.
    vec3 tangentL = L - N * NdotL;
    vec3 tangentV = V - N * NdotV;
    float cosPhiDiff = 0.0;
    if (dot(tangentL, tangentL) > 1e-8 && dot(tangentV, tangentV) > 1e-8) {
        cosPhiDiff = max(dot(normalize(tangentL), normalize(tangentV)), 0.0);
    }

    float thetaI = acos(clamp(NdotL, 0.0, 1.0));
    float thetaR = acos(clamp(NdotV, 0.0, 1.0));
    float alpha = max(thetaI, thetaR);
    // tan() explodes as the smaller angle approaches PI/2; the term is already
    // multiplied by a vanishing NdotL, so clamping only removes the spike.
    float beta = min(min(thetaI, thetaR), 1.4);

    float orenNayar = A + B * cosPhiDiff * sin(alpha) * tan(beta);

    // Unit-radiance light: the PI that cancels the Lambert 1/PI lives here.
    vec3 finalColor = albedo * orenNayar * NdotL;

    fragColor = vec4(finalColor, 1.0);
}
