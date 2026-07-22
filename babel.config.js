module.exports = {
  // Ignore CSS files from Babel processing
  ignore: ["**/*.css"],
  plugins: [
    // Enable legacy decorator syntax
    ["@babel/plugin-proposal-decorators", { "legacy": true }],
    // Optional syntax plugin (if needed)
    "@babel/plugin-syntax-decorators"
  ]
};
