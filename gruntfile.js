module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.loadNpmTasks('grunt-contrib-clean');
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
                    '!**/typings/**',
                    '!**/node_modules/**']
            },
        },
        ts: {
            default: {
                src: ['**/*.ts', '!**/typings/**', '!**/node_modules/**'],
                dest: '.',
                options: {
                    module: 'commonjs', //or commonjs
                    target: 'es5', //or es3
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
        },
        babel: {
            options: {
                sourceMap: true,
                retainLines: true
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: '.',
                    src: ['**/*.es6'],
                    dest: '.',
                    ext: '.js'
                }]
            }
        }
    });
    grunt.registerTask('default', ['clean', 'ts']);
    grunt.registerTask('dev', ['clean', 'ts', 'mochatest']);
}
