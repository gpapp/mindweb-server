module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.initConfig({
        clean: {
            gen: {
                expand: true,
                cwd: '.',
                src: ['**/*.js',
                    '**/*.js.map',
                    '!**/gruntfile.js',
                    '**/*.d.ts',
                    '!**/node_modules/**']
            },
        },
        ts: {
            default: {
                src: ['**/*.ts','!**/node_modules/**'],
                dest: '.',
                options: {
                    module: 'commonjs', //or commonjs
                    target: 'es6', //or es3
                    sourceMap: true,
                    declaration: false
                }
            }
        },
        mochaTest: {
            default: {
                options: {

                },
                src: ['test/**/*.js']
            }
        }
    });
    grunt.registerTask('default', ['clean', 'ts']);
    grunt.registerTask('dev', ['clean', 'ts', 'mochaTest']);
}
